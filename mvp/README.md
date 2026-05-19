# MVP: Financial Document Intelligence Platform

This MVP provides a runnable skeleton for ingestion, RAG Q&A with citations, and queue-based workers. It includes infrastructure-as-code (Terraform), queue adapters for Redis and SQS, and a basic Node.js API.

## What this MVP includes

- API service with upload + Q&A endpoints
- Queue adapters: Redis (BullMQ) or AWS SQS
- RAG pipeline with pgvector and a self-hosted embeddings + LLM endpoint
- Minimal worker loops for ingestion and Q&A
- Terraform to provision S3, SQS, Redis (ElastiCache), RDS Postgres, and EC2
- OCR pipeline with pdf-parse + tesseract.js
- React UI (Vite)

## Requirements

- Node.js 18+
- Postgres 14+ with pgvector extension
- AWS account and credentials (for SQS/S3/EC2/RDS/ElastiCache)
- OCR dependencies: `canvas` native build (requires build tools)

## Quick Start

1) Install dependencies

```
npm install
```

2) Configure environment

```
cp .env.example .env
```

3) Create database schema

```
node src/db/migrate.js
```

4) Run API

```
npm run start
```

5) Run workers (separate terminals)

```
npm run worker:ingest
npm run worker:qa
```

6) Run UI (optional)

```
cd ui
npm install
npm run dev
```

## OAuth (Google)

- Create an OAuth client in Google Cloud Console.
- Set the redirect URL to `http://localhost:3000/auth/google/callback`.
- Fill in `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `JWT_SECRET`, `SESSION_SECRET`, and `UI_BASE_URL` in `.env`.
- Start the API and visit `http://localhost:5173/login`.

## Queue backend selection

- Redis: set `QUEUE_BACKEND=redis` and `REDIS_URL=redis://...`
- SQS: set `QUEUE_BACKEND=sqs` and `SQS_QUEUE_URL=...`

## RAG flow (high level)

- Upload document -> metadata in Postgres -> enqueue ingestion job
- Ingestion worker extracts text (pdf-parse) or OCRs pages (tesseract.js)
- Chunks are embedded and stored in pgvector
- Questions retrieve top-k chunks, build a prompt, call the LLM
- Answers return citations with page + bbox

## OCR pipeline notes

- Text-based PDFs are parsed with `pdf-parse`.
- Scanned PDFs are rendered by `pdfjs-dist` and OCRed with `tesseract.js`.
- Control behavior with `OCR_LANGUAGES`, `OCR_MAX_PAGES`, `OCR_TEXT_MIN_CHARS`.

## Terraform

Terraform scripts live in [mvp/infra/terraform](mvp/infra/terraform).

### Notes

- This is a minimal, dev-friendly baseline.
- For production, use private subnets, NAT, IAM roles, and locked-down security groups.

