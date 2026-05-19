const Redis = require("ioredis");
const { config } = require("../config");

const redis = new Redis(config.redisUrl);
const pub = new Redis(config.redisUrl);
const sub = new Redis(config.redisUrl);

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
