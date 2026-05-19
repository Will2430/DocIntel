const { config } = require("../config");

async function answerWithContext({ question, chunks }) {
  if (!config.modelLlmUrl) {
    throw new Error("MODEL_LLM_URL not configured");
  }

  const context = chunks.map((c, i) => `Chunk ${i + 1}: ${c.text}`).join("\n\n");

  const prompt = [
    "You are a financial analyst assistant.",
    "Answer the question using only the provided context.",
    "If the answer is not present, say you do not know.",
    "",
    `Question: ${question}`,
    "",
    "Context:",
    context
  ].join("\n");

  const headers = { "Content-Type": "application/json" };
  if (config.llmApiKey) {
    headers.Authorization = `Bearer ${config.llmApiKey}`;
  }

  const res = await fetch(config.modelLlmUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.llmModel || "llama3.2:3b",
      messages: [
        { role: "system", content: "You are a financial analyst assistant." },
        { role: "user", content: prompt }
      ],
      stream: false,
      temperature: 0.2
    })
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status}`);
  }

  const data = await res.json();
  const message = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;

  return (
    message ||
    data.answer ||
    data.response ||
    data.text ||
    data.generated_text ||
    ""
  );
}

module.exports = { answerWithContext };
