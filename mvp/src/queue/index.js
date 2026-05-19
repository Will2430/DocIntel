const { config } = require("../config");
const { createRedisQueue } = require("./redisQueue");
const { sendMessage, receiveMessages, deleteMessage } = require("./sqsQueue");

function getQueue(queueName) {
  if (config.queueBackend === "sqs") {
    return {
      add: async (payload) => sendMessage({ queueName, payload }),
      receive: async () => receiveMessages(),
      ack: async (message) => deleteMessage(message.ReceiptHandle)
    };
  }

  const queue = createRedisQueue(queueName);
  return {
    add: async (payload) => queue.add(queueName, payload)
  };
}

module.exports = { getQueue };
