# Financial Document Intelligence Platform (MVP)

Upload financial PDFs, run OCR, ask questions, and get cited answers. This is a mvp with implementations mostly for learning purposes

## Features

- PDF ingestion with OCR fallback (text-first, image OCR if needed)
- RAG Q&A with page-level citations
- Redis + BullMQ job processing
- SSE streaming of answers (token-by-token)
- Postgres + pgvector for embeddings
- Google OAuth (JWT cookie)

## Technology Stack

### Frontend
- React + Vite

### Backend
- Node.js + Express

### Queue and Database
- Redis(BullMQ) + Postgres & PGvector


## Repository Structure

- MVP code: [mvp](mvp)
- Implementation plan: [financial-doc-intel-implementation-plan.md](financial-doc-intel-implementation-plan.md)
- Debugging summary: [mvp/debugging-summary.md](mvp/debugging-summary.md)

## Quick Start (Local + Docker)

### 1) Start infrastructure (Redis, Postgres, Ollama, TEI)

```
docker-compose up -d
```

This uses [mvp/compose.yml](mvp/compose.yml).

### 2) Configure environment

Copy and edit:

```
cp mvp/.env.example mvp/.env
```

Update:
- Redis/Postgres URLs
- `MODEL_EMBEDDINGS_URL`
- `MODEL_LLM_URL`
- OAuth secrets (if used)

### 3) Install dependencies

```
cd mvp
npm install
```

### 4) Run migrations

```
npm run migrate
```

### 5) Start API + workers

```
npm run start
npm run worker:ingest
npm run worker:qa
```

### 6) Start UI

```
cd mvp/ui
npm install
npm run dev
```

Open:
- UI: http://localhost:5173
- API: http://localhost:3000/health

## Environment Variables

See [mvp/.env.example](mvp/.env.example) for the full list. Important ones:

- `PG_URL`
- `REDIS_URL`
- `MODEL_EMBEDDINGS_URL` (TEI)
- `MODEL_LLM_URL` (Ollama `/api/chat` or `/api/generate`)
- `LLM_MODEL`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`

## Google OAuth and JWT token Signing

- Utilizes google passport and strategies for authentification. After successful auth, the backend issues a signed JWT containing user identity claims
- The signed token is then passed along any subsequent API calls
- Secure cookie configuration and SameSite policies help mitigate CSRF attacks.

## LLM + Embeddings

- Embeddings are provided by TEI (`/embed`) and stored in pgvector.
- LLM answers are generated via Ollama endpoints:
  - `/api/chat` (chat format)
  - `/api/generate` (prompt format)

## Streaming Answer Flow

- UI sends `POST /questions` and receives a `jobId`.
- UI opens `GET /questions/:jobId/stream` (SSE).
- Worker streams tokens via Redis Pub/Sub to the SSE channel.

## Notes

- OCR relies on `canvas` (native dependency). On Windows, install build tools or run the OCR worker in WSL/Linux.
- If you run Node in WSL and Docker on Windows, use the Windows host IP in `.env` for Redis/Postgres/LLM/TEI.

## Scripts

From [mvp/package.json](mvp/package.json):

- `npm run start` — API server
- `npm run worker:ingest` — ingestion worker
- `npm run worker:qa` — QA worker
- `npm run migrate` — database migrations

