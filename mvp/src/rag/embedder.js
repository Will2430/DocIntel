const { config } = require("../config");

async function embedText(text) {
  if (!config.modelEmbeddingsUrl) {
    throw new Error("MODEL_EMBEDDINGS_URL not configured");
  }

  const res = await fetch(config.modelEmbeddingsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input: text })
  });

  if (!res.ok) {
    throw new Error(`Embedding request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.embedding;
}

module.exports = { embedText };
