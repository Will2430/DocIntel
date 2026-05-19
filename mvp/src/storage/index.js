const { config } = require("../config");
const s3 = require("./s3");
const local = require("./local");

const backend = config.storageBackend === "local" ? local : s3;

module.exports = {
	uploadPdf: backend.uploadPdf,
	getObject: backend.getObject
};