const dotenv = require("dotenv");

dotenv.config();

const config = {
  port: parseInt(process.env.PORT || "3000", 10),
  pgUrl: process.env.PG_URL,
  redisUrl: process.env.REDIS_URL,
  storageBackend: process.env.STORAGE_BACKEND || "local",
  queueBackend: process.env.QUEUE_BACKEND || "redis",
  sqsQueueUrl: process.env.SQS_QUEUE_URL,
  sqsDlqUrl: process.env.SQS_DLQ_URL,
  awsRegion: process.env.AWS_REGION || "ap-southeast-1",
  s3Bucket: process.env.S3_BUCKET,
  modelEmbeddingsUrl: process.env.MODEL_EMBEDDINGS_URL,
  modelLlmUrl: process.env.MODEL_LLM_URL,
  llmApiKey: process.env.LLM_API_KEY,
  llmModel: process.env.LLM_MODEL,
  googleClientId: process.env.GOOGLE_CLIENT_ID,
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET,
  googleCallbackUrl: process.env.GOOGLE_CALLBACK_URL,
  jwtSecret: process.env.JWT_SECRET || "dev-jwt-secret",
  sessionSecret: process.env.SESSION_SECRET || "dev-session-secret",
  uiBaseUrl: process.env.UI_BASE_URL || "http://localhost:5173",
  cookieSecure: process.env.COOKIE_SECURE === "true",
  ocrLanguages: process.env.OCR_LANGUAGES || "eng+msa",
  ocrMaxPages: parseInt(process.env.OCR_MAX_PAGES || "5", 10),
  ocrTextMinChars: parseInt(process.env.OCR_TEXT_MIN_CHARS || "200", 10)
};

module.exports = { config };
