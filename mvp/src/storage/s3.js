const AWS = require("aws-sdk");
const { config } = require("../config");

AWS.config.update({ region: config.awsRegion });

const s3InitOptions = {
    signatureVersion: "u4"
};

if (config.s3Endpoint) {
    s3InitOptions.endpoint = config.s3Endpoint;
    s3InitOptions.s3ForcePathStyle = config.s3ForcePathStyle || false; // Required for custom endpoint
} 

const s3 = new AWS.S3(
    config.s3Endpoint ? s3InitOptions : undefined
);

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
