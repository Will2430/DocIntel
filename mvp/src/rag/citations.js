function buildCitations(chunks) {
  return chunks.map((chunk) => ({
    documentId: chunk.document_id,
    page: chunk.page_number,
    bbox: chunk.bbox,
    score: chunk.score
  }));
}

module.exports = { buildCitations };
