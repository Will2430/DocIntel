const express = require("express");
const multer = require("multer");
const { v4: uuidv4 } = require("uuid");
const { pool } = require("../db");
const { uploadPdf } = require("../storage");
const { getQueue } = require("../queue");

const router = express.Router();
const upload = multer();
const ingestQueue = getQueue("ingest_document");

router.post("/upload", upload.single("file"), async (req, res) => {
  const tenantId = req.headers["x-tenant-id"] || (req.user && req.user.tenantId);
  const file = req.file;
  const textOverride = req.body.text || "";

  if (!tenantId || !file) {
    return res.status(400).json({ error: "Missing tenant or file" });
  }

  const docId = uuidv4();
  const s3Key = `raw/${tenantId}/${docId}.pdf`;

  await uploadPdf({ key: s3Key, buffer: file.buffer, contentType: file.mimetype });

  await pool.query(
    `INSERT INTO documents (id, tenant_id, filename, s3_key) 
    VALUES ($1, $2, $3, $4)`,
    [docId, tenantId, file.originalname, s3Key]
  );

  if (textOverride) {
    await ingestQueue.add({ tenantId, docId, textOverride });
  } else {
    await ingestQueue.add({ tenantId, docId });
  }

  return res.json({ id: docId, status: "queued" });
});

module.exports = { documentsRouter: router };
