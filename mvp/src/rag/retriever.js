const { pool } = require("../db");
const { embedText } = require("./embedder");
const pgvector = require("pgvector");

async function retrieveChunks({ tenantId, documentIds, query, topK }) {
  const embedding = await embedText(query);
  const embeddingLiteral = pgvector.toSql(embedding);

  // 1 - cosine similarity give us a score where higher is better, 
  // since pgvector's <=> operator returns distance
  
  // * ANY is a boolean operator that is used to compare the document_id against an array of UUIDs, 
  // allowing us to filter chunks that belong to any of the specified documents
  const res = await pool.query(
    `SELECT id, document_id, page_number, bbox, text,
            1 - (embedding <=> $3::vector) AS score
     FROM chunks
     WHERE tenant_id = $1 AND document_id = ANY($2::uuid[])
     ORDER BY embedding <=> $3::vector
     LIMIT $4`,
    [tenantId, documentIds, embeddingLiteral, topK]
  );

  return res.rows;
}

module.exports = { retrieveChunks };
