const express = require("express");
const { v4: uuidv4 } = require("uuid");
const { getQueue } = require("../queue");
const {
  redis,
  sub,
  jobKey,
  jobMetaKey,
  jobStatusKey,
  jobResultKey
} = require("../redis");

const router = express.Router();
const answerQueue = getQueue("answer_question");
const JOB_TTL_SECONDS = 60 * 60;

router.post("/", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || (req.user && req.user.tenantId);
  const { question, documentIds } = req.body || {};
  const jobId = uuidv4();

  if (!tenantId || !question || !Array.isArray(documentIds)) {
    return res.status(400).json({ error: "Missing tenant, question, or documentIds" });
  }

  const meta = { tenantId, question, documentIds };

  await redis.set(jobMetaKey(jobId), JSON.stringify(meta), "EX", JOB_TTL_SECONDS);
  await redis.set(jobStatusKey(jobId), "queued", "EX", JOB_TTL_SECONDS);
  
  // Enqueue the job for processing by the worker
  const job = await answerQueue.add({ jobId, ...meta });
  console.log("Enqueued answer job", { jobId, queueJobId: job && job.id });

  return res.json({ jobId, status: "queued" });
});

router.get("/:jobId/stream", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || (req.user && req.user.tenantId);
  const { jobId } = req.params;

  console.log("SSE subscribe", { jobId });
  const metaRaw = await redis.get(jobMetaKey(jobId));
  if (!metaRaw) {
    return res.status(404).json({ error: "Job not found" });
  }

  let meta;
  try {
    meta = JSON.parse(metaRaw);
  } catch (err) {
    return res.status(500).json({ error: "Job metadata invalid" });
  }

  if (!tenantId || meta.tenantId !== tenantId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (res.flushHeaders) {
    res.flushHeaders();
  }

  res.write(`event: job\ndata: ${JSON.stringify({ jobId })}\n\n`);

  // Persistence check in case client connects after job is done
  const status = await redis.get(jobStatusKey(jobId));
  if (status === "done") {
    const resultRaw = await redis.get(jobResultKey(jobId));
    if (resultRaw) {
      res.write(`event: done\ndata: ${resultRaw}\n\n`);
    }
    return res.end();
  }
  // duplicate a isolated redis connection for subscription due to sub/pub behaviour,
  // where after a subscription is made, the connection cannot be used for other commands
  // as it is dedicated to listening to messages from the subscribed channel
  const subscriber = sub.duplicate();
  subscriber.on("error", (err) => {
    console.error("Redis subscriber error", err.message);
  });
  const channel = jobKey(jobId);
  let closed = false;

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  // Listen and propagate messages from the worker via Redis Pub/Sub
  const onMessage = (channelName, message) => {
    let payload;
    // This is defensive parsing in case the worker sends non-JSON messages (like raw tokens),
    // as plain text messages would cause JSON.parse to throw an error, we can fallback to
    //  treating the message as a incremantal token payload
    try {
      payload = JSON.parse(message);
    } catch (err) {
      payload = { type: "token", token: message };
    }

    if (payload.type === "done") {
      res.write(`event: done\ndata: ${JSON.stringify(payload)}\n\n`);
      cleanup().finally(() => res.end());
      return;
    }

    if (payload.type === "error") {
      res.write(`event: error\ndata: ${JSON.stringify(payload)}\n\n`);
      cleanup().finally(() => res.end());
      return;
    }

    if (payload.type === "status") {
      res.write(`event: status\ndata: ${JSON.stringify(payload)}\n\n`);
      return;
    }
    // this res write is part of the main try block, and is placed after all the if conditions 
    // to ensure that any message that doesnt match the expected types (done, error, status) is treated as a token message 
    // and sent to the client accordingly, this also ensures that even if the worker sends unexpected messages, the SSE stream remains functional 
    // and can handle them gracefully without crashing or breaking the connection
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  // Make the cleanup function defensive, as before there isnt error handling when the function throws, 
  // which supposedly causes the Redis connection to drop and crashes the backend service, 
  // opt for disconnect instead of quit to avoid the risk of the quit command hanging 
  // if the connection is already in a bad state
  const cleanup = async () => {
    if (closed) {
      return;
    }
    closed = true;

    clearInterval(heartbeat);
    subscriber.removeListener("message", onMessage);

    try {
      if (subscriber.status === "ready" || subscriber.status === "connecting") {
        await subscriber.unsubscribe(channel);
      }
    } catch (err) {
      console.error("SSE cleanup unsubscribe error", err.message);
    }

    try {
      subscriber.disconnect();
    } catch (err) {
      console.error("SSE cleanup disconnect error", err.message);
    }
  };

  subscriber.on("message", onMessage);
  await subscriber.subscribe(channel);

  req.on("close", () => {
    cleanup();
  });
});

module.exports = { questionsRouter: router };
