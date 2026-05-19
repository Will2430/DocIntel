const { config } = require("../config");
const { getObject } = require("../storage/index");
const { pool } = require("../db");
const { embedText } = require("../rag/embedder");
const { v4: uuidv4 } = require("uuid");
const { getQueue } = require("../queue");
const { extractChunksFromPdf } = require("../ocr/ocrPipeline");

const queue = getQueue("ingest_document");

async function handleIngest(job) {
  const { tenantId, docId, textOverride } = job.payload || job.data || {};

  if (!tenantId || !docId) {
    return;
  }

  let chunks = [];

  if (textOverride) {
    chunks = [{
      pageNumber: 1,
      text: textOverride,
      bbox: { x1: 0, y1: 0, x2: 1, y2: 1 }
    }];
  } else {
    const s3Key = `raw/${tenantId}/${docId}.pdf`;
    const pdfObject = await getObject({ key: s3Key });
    const pdfBuffer = pdfObject.Body || pdfObject.data;
    if (!pdfBuffer) {
      throw new Error("PDF buffer missing from storage backend");
    }
    chunks = await extractChunksFromPdf(pdfBuffer);
  }

  for (const chunk of chunks) {
    const embedding = await embedText(chunk.text);
    const chunkId = uuidv4();

    await pool.query(
      "INSERT INTO chunks (id, tenant_id, document_id, page_number, bbox, text, embedding) VALUES ($1, $2, $3, $4, $5, $6, $7)",
      [
        chunkId,
        tenantId,
        docId,
        chunk.pageNumber,
        JSON.stringify(chunk.bbox),
        chunk.text,
        embedding
      ]
    );
  }

  await pool.query("UPDATE documents SET status = $1 WHERE id = $2", ["indexed", docId]);
}
async function runRedis() {
  const { Worker } = require("bullmq");
  new Worker(
    "ingest_document",
    async (job) => handleIngest(job),
    { connection: { url: config.redisUrl } }
  );
}

async function runSqs() {
  while (true) {
    const messages = await queue.receive();
    for (const message of messages) {
      const body = JSON.parse(message.Body || "{}");
      await handleIngest({ payload: body.payload });
      await queue.ack(message);
    }
  }
}

if (config.queueBackend === "sqs") {
  runSqs();
} else {
  runRedis();
}
