const AWS = require("aws-sdk");
const { config } = require("../config");

AWS.config.update({ region: config.awsRegion });

const s3 = new AWS.S3();

async function uploadPdf({ key, buffer, contentType }) {
  return s3
    .putObject({
      Bucket: config.s3Bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType
    })
    .promise();
}

async function getObject({ key }) {
  return s3
    .getObject({
      Bucket: config.s3Bucket,
      Key: key
    })
    .promise();
}

module.exports = { uploadPdf, getObject };
