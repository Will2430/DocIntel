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

  const model = config.llmModel || "llama3.2:3b";
  const useGenerateEndpoint = config.modelLlmUrl.includes("/api/generate");
  const body = useGenerateEndpoint
    ? {
        model,
        prompt,
        stream: false
      }
    : {
        model,
        messages: [
          { role: "system", content: "You are a financial analyst assistant." },
          { role: "user", content: prompt }
        ],
        stream: false,
        temperature: 0.2
      };

  const res = await fetch(config.modelLlmUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status}`);
  }

  const rawText = await res.text();
  let data;

  try {
    data = JSON.parse(rawText);
  } catch (err) {
    const lines = rawText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => (line.startsWith("data:") ? line.slice(5).trim() : line));

    const lastLine = lines[lines.length - 1];
    if (!lastLine) {
      throw new Error("LLM response was empty or not valid JSON");
    }

    data = JSON.parse(lastLine);
  }
  const message = data.choices && data.choices[0] && data.choices[0].message
    ? data.choices[0].message.content
    : null;
  const ollamaMessage = data.message && data.message.content ? data.message.content : null;

  return (
    message ||
    ollamaMessage ||
    data.answer ||
    data.response ||
    data.text ||
    data.generated_text ||
    ""
  );
}

function buildPrompt(question, chunks) {
  const context = chunks.map((c, i) => `Chunk ${i + 1}: ${c.text}`).join("\n\n");

  return [
    "You are a financial analyst assistant.",
    "Answer the question using only the provided context.",
    "If the answer is not present, say you do not know.",
    "",
    `Question: ${question}`,
    "",
    "Context:",
    context
  ].join("\n");
}

async function streamAnswerWithContext({ question, chunks, onToken }) {
  if (!config.modelLlmUrl) {
    throw new Error("MODEL_LLM_URL not configured");
  }

  const prompt = buildPrompt(question, chunks);
  const headers = { "Content-Type": "application/json" };
  if (config.llmApiKey) {
    headers.Authorization = `Bearer ${config.llmApiKey}`;
  }

  const model = config.llmModel || "llama3.2:3b";
  const useGenerateEndpoint = config.modelLlmUrl.includes("/api/generate");
  const body = useGenerateEndpoint
    ? {
        model,
        prompt,
        stream: true
      }
    : {
        model,
        messages: [
          { role: "system", content: "You are a financial analyst assistant." },
          { role: "user", content: prompt }
        ],
        stream: true,
        temperature: 0.2
      };

  const res = await fetch(config.modelLlmUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`LLM request failed: ${res.status} ${errorText}`);
  }

  if (!res.body) {
    throw new Error("LLM response missing body stream");
  }
  
  // decoder is used to convert raw bytes from the stream into text, because
  // the network streams are typically in bytes and we need to decode them into a 
  // string format to process the tokens.
  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";

  const handleToken = (token) => {
    if (!token) {
      return;
    }
    fullText += token;
    // the on token callback is defined in the this function caller, for exmaple
    // whenever the main fucntion's caller invokes the onToken callback, it gets called from the 
    // handleJson function which is responsible for processing the incoming stream data 
    // and extracting tokens from it.
    if (onToken) {
      onToken(token);
    }
  };

  const handleJson = (json) => {
    if (!json || json.done) {
      return;
    }

    const token =
      (json.message && json.message.content) ||
      json.response ||
      (json.choices && json.choices[0] && json.choices[0].delta
        ? json.choices[0].delta.content
        : null) ||
      (json.choices && json.choices[0] && json.choices[0].message
        ? json.choices[0].message.content
        : null);

    handleToken(token);
  };

  const handleLine = (line) => {
    const trimmed = line.trim();
    if (!trimmed) {
      return;
    }
    // we slice the data: prefix if it exists because some streaming APIs (like OpenAI's) send data in the format of 
    // "data: {json}\n\n". By removing the "data:" prefix, we can isolate the JSON payload and parse it correctly. 
    // If the line doesn't start with "data:", we treat the entire line as the payload.
    const payload = trimmed.startsWith("data:")
      ? trimmed.slice(5).trim()
      : trimmed;

    if (payload === "[DONE]") {
      return;
    }

    try {
      const json = JSON.parse(payload);
      handleJson(json);
    } catch (err) {
      // Ignore malformed chunks.
    }
  };

  for await (const chunk of res.body) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    // we pop the last line from the lines array and 
    // keep it in the buffer variable because it may be an incomplete 
    // line that we haven't received fully yet. By keeping it in the buffer, 
    // we can prepend it to the next chunk of data we receive, 
    // ensuring that we process complete lines of data when they are fully received.
    buffer = lines.pop() || "";
    for (const line of lines) {
      handleLine(line);
    }
  }

  if (buffer.trim()) {
    handleLine(buffer);
  }

  return fullText;
}

module.exports = { answerWithContext, streamAnswerWithContext };
