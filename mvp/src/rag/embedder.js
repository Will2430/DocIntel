const { config } = require("../config");

async function embedText(text) {
  if (!config.modelEmbeddingsUrl) {
    throw new Error("MODEL_EMBEDDINGS_URL not configured");
  }

  const res = await fetch(config.modelEmbeddingsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inputs: text })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Embedding request failed: ${res.status} ${errorText}`);
  }

  const data = await res.json();
  let embedding;

  if (Array.isArray(data)) {
    embedding = Array.isArray(data[0]) ? data[0] : data;
  } else if (data.embedding) {
    embedding = data.embedding;
  } else if (Array.isArray(data.embeddings) && Array.isArray(data.embeddings[0])) {
    embedding = data.embeddings[0];
  }

  if (!embedding) {
    throw new Error("Embedding response format not recognized");
  }
  // Ensure all values are numbers (e.g., convert from strings if necessary)
  return embedding.map((value) => Number(value));
}

module.exports = { embedText };
