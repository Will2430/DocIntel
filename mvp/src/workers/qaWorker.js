const { config } = require("../config");
const { retrieveChunks } = require("../rag/retriever");
const { answerWithContext, streamAnswerWithContext } = require("../rag/answerer");
const { buildCitations } = require("../rag/citations");
const { pool } = require("../db");
const { v4: uuidv4 } = require("uuid");
const { getQueue } = require("../queue");
const {
  redis,
  pub,
  jobKey,
  jobStatusKey,
  jobResultKey
} = require("../redis");

const queue = getQueue("answer_question");

async function handleQuestion(job) {
  const { jobId, tenantId, question, documentIds } = job.payload || job.data || {};

  if (!jobId || !tenantId || !question || !Array.isArray(documentIds)) {
    return;
  }

  console.log("QA worker start", { jobId, tenantId, docs: documentIds.length });

  try {
    await redis.set(jobStatusKey(jobId), "running", "EX", 3600);
    await pub.publish(jobKey(jobId), JSON.stringify({ type: "status", status: "running" }));

    const chunks = await retrieveChunks({
      tenantId,
      documentIds,
      query: question,
      topK: 6
    });

    let answer = "";
    answer = await streamAnswerWithContext({
      question,
      chunks,
      onToken: (token) => {
        pub.publish(jobKey(jobId), JSON.stringify({ type: "token", token }));
      }
    });
    if (!answer) {
      answer = await answerWithContext({ question, chunks });
    }
    const citations = buildCitations(chunks);

    console.log("QA worker got answer", { jobId, answer, citations: citations.length });

    const queryId = uuidv4();
    await pool.query(
      "INSERT INTO qa_queries (id, tenant_id, question, answer, citations) VALUES ($1, $2, $3, $4, $5)",
      [queryId, tenantId, question, answer, JSON.stringify(citations)]
    );

    const result = { answer, citations };
    await redis.set(jobResultKey(jobId), JSON.stringify(result), "EX", 3600);
    await redis.set(jobStatusKey(jobId), "done", "EX", 3600);
    await pub.publish(jobKey(jobId), JSON.stringify({ type: "done", ...result }));
    console.log("QA worker done", { jobId });
  } catch (err) {
    await redis.set(jobStatusKey(jobId), "error", "EX", 3600);
    await pub.publish(jobKey(jobId), JSON.stringify({ type: "error", message: err.message }));
    console.error("QA worker failed", { jobId, error: err.message });
  }
}

async function runRedis() {
  const { Worker } = require("bullmq");
  const worker = new Worker(
    "answer_question",
    async (job) => handleQuestion(job),
    { connection: { url: config.redisUrl } }
  );

  worker.on("failed", (job, err) => {
    console.error("QA worker failed", { jobId: job && job.id, error: err.message });
  });
}

async function runSqs() {
  while (true) {
    const messages = await queue.receive();
    for (const message of messages) {
      const body = JSON.parse(message.Body || "{}");
      await handleQuestion({ payload: body.payload });
      await queue.ack(message);
    }
  }
}

if (config.queueBackend === "sqs") {
  runSqs();
} else {
  runRedis();
}
