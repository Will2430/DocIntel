const { pool } = require("../db");
const { embedText } = require("./embedder");
const pgvector = require("pgvector");

async function retrieveChunks({ tenantId, documentIds, query, topK }) {
  const embedding = await embedText(query);
  const embeddingLiteral = pgvector.toSql(embedding);

  const res = await pool.query(
    `SELECT id, document_id, page_number, bbox, text,
            1 - (embedding <=> ${embeddingLiteral}) AS score
     FROM chunks
     WHERE tenant_id = $1 AND document_id = ANY($2::uuid[])
     ORDER BY embedding <=> ${embeddingLiteral}
     LIMIT $3`,
    [tenantId, documentIds, topK]
  );

  return res.rows;
}

module.exports = { retrieveChunks };
