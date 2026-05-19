const { Queue } = require("bullmq");
const { config } = require("../config");

function createRedisQueue(queueName) {
  return new Queue(queueName, {
    connection: { url: config.redisUrl }
  });
}

module.exports = { createRedisQueue };
