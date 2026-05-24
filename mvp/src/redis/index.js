const Redis = require("ioredis");
const { config } = require("../config");

const redis = new Redis(config.redisUrl);
const pub = new Redis(config.redisUrl);
const sub = new Redis(config.redisUrl);

redis.on("error", (err) => {
  console.error("Redis error:", err);
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

pub.on("error", (err) => {
  console.error("Redis pub error:", err);
});

sub.on("error", (err) => {
  console.error("Redis sub error:", err);
});

// Helper functions to generate Redis keys for job management

// Redis keys for different state and data management of the question-answering jobs
function jobKey(jobId) {
  return `job:${jobId}`;
}

function jobMetaKey(jobId) {
  return `job:${jobId}:meta`;
}

function jobStatusKey(jobId) {
  return `job:${jobId}:status`;
}

function jobResultKey(jobId) {
  return `job:${jobId}:result`;
}

module.exports = {
  redis,
  pub,
  sub,
  jobKey,
  jobMetaKey,
  jobStatusKey,
  jobResultKey
};
