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

  await answerQueue.add({ jobId, ...meta });

  return res.json({ jobId, status: "queued" });
});

router.get("/:jobId/stream", async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || (req.user && req.user.tenantId);
  const { jobId } = req.params;

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

  const status = await redis.get(jobStatusKey(jobId));
  if (status === "done") {
    const resultRaw = await redis.get(jobResultKey(jobId));
    if (resultRaw) {
      res.write(`event: done\ndata: ${resultRaw}\n\n`);
    }
    return res.end();
  }

  const subscriber = sub.duplicate();
  const channel = jobKey(jobId);

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15000);

  const onMessage = (channelName, message) => {
    let payload;
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

    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  const cleanup = async () => {
    clearInterval(heartbeat);
    subscriber.removeListener("message", onMessage);
    await subscriber.unsubscribe(channel);
    await subscriber.quit();
  };

  subscriber.on("message", onMessage);
  await subscriber.subscribe(channel);

  req.on("close", () => {
    cleanup();
  });
});

module.exports = { questionsRouter: router };
