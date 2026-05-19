const AWS = require("aws-sdk");
const { config } = require("../config");

AWS.config.update({ region: config.awsRegion });

const sqs = new AWS.SQS();

async function sendMessage(payload) {
  return sqs
    .sendMessage({
      QueueUrl: config.sqsQueueUrl,
      MessageBody: JSON.stringify(payload)
    })
    .promise();
}

async function receiveMessages() {
  const res = await sqs
    .receiveMessage({
      QueueUrl: config.sqsQueueUrl,
      MaxNumberOfMessages: 10,
      WaitTimeSeconds: 10
    })
    .promise();

  return res.Messages || [];
}

async function deleteMessage(receiptHandle) {
  return sqs
    .deleteMessage({
      QueueUrl: config.sqsQueueUrl,
      ReceiptHandle: receiptHandle
    })
    .promise();
}

module.exports = { sendMessage, receiveMessages, deleteMessage };
