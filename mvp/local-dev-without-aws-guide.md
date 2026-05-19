# Local-First Development (No AWS) With a Path to AWS Later

This guide explains how to run the MVP locally using Docker and keep the code flexible so it can switch to AWS later. It focuses on **how to design the code**, **what to change**, and **what docs to read**, without applying changes for you.

## Goal

- Run locally with Docker (Redis, Postgres, object storage).
- Keep code clean and switchable to AWS by config only.
- Avoid rewriting business logic when moving to AWS.

## Strategy (Keep It Portable)

Use **adapters** and **configuration switches** so core logic never cares where storage or queues live.

### Principles

1. **Define stable interfaces** for storage and queues.
2. **Select implementation by environment variables**, not by code branches in business logic.
3. **Keep AWS-specific options isolated** in adapters (S3 client, SQS client).
4. **Match local behavior to AWS** (bucket paths, queue payloads) so migration is config only.

## Local Replacements for AWS

| AWS Service | Local Replacement | Notes |
|---|---|---|
| S3 | MinIO (Docker) or local disk | MinIO uses S3-compatible API.
| SQS | Redis (BullMQ) or LocalStack SQS | Redis is simplest and already in the code.
| RDS Postgres | Postgres (Docker) | Same driver.
| EC2 | Your machine | Local Node processes.

## Step-by-Step Approach

### 1) Decide your local stack

**Minimal local stack** (recommended for now):
- Postgres (Docker)
- Redis (Docker)
- Optional: MinIO if you want S3-like storage

**Optional**:
- LocalStack if you want to simulate SQS

### 2) Add a storage adapter layer

You already have `src/storage/s3.js`. To be local-first, make a small **storage interface** and choose implementation by config:

- `src/storage/index.js` should export:
  - `uploadPdf({ key, buffer, contentType })`
  - `getObject({ key })`

Then implement:
- `src/storage/s3.js` (for AWS / MinIO)
- `src/storage/local.js` (for local filesystem)

#### Example logic (structure only)

```js
// src/storage/index.js
const { config } = require("../config");
const s3 = require("./s3");
const local = require("./local");

module.exports = config.storageBackend === "local" ? local : s3;
```

#### Local storage behavior

- Map keys like `raw/{tenant}/{doc}.pdf` to `./data/raw/{tenant}/{doc}.pdf`.
- `getObject()` should return `{ Body: Buffer }`, same shape as S3.

### 3) Configure S3-compatible storage for local

If you want to avoid local filesystem and be closer to AWS, use **MinIO**:

- Point AWS SDK to MinIO by setting:
  - `S3_ENDPOINT=http://localhost:9000`
  - `S3_FORCE_PATH_STYLE=true`
  - `S3_ACCESS_KEY` and `S3_SECRET_KEY`

This lets you keep the S3 adapter but run locally.

### 4) Keep Redis as the queue locally

Your queue code already supports Redis. For local runs:

```
QUEUE_BACKEND=redis
REDIS_URL=redis://localhost:6379
```

For AWS later:

```
QUEUE_BACKEND=sqs
SQS_QUEUE_URL=...
```

No change to business logic should be needed.

### 5) Keep Postgres local

Use a Dockerized Postgres and keep the same schema. That is already portable to RDS.

### 6) Keep OCR local

Tesseract runs locally as a Node dependency. For Windows, it may need build tools or you can run the OCR pipeline inside a Linux container later.

### 7) Separate configs per environment

Use `.env` for local, and `.env.aws` for AWS later. In code, prefer:

```
STORAGE_BACKEND=local
QUEUE_BACKEND=redis
```

When moving to AWS, just switch the environment file.

## Docker Compose (Recommended Layout)

Even if you do not create it now, the eventual Docker Compose should include:

- `postgres`
- `redis`
- `minio` (optional)

If you want SQS locally, add:

- `localstack` with SQS enabled

## What to Look For in Documentation

Here are the key docs you should read or search for:

### AWS SDK (S3 + MinIO)
- Search: "aws-sdk s3 endpoint s3ForcePathStyle"
- Search: "minio s3 compatibility node aws-sdk"

### MinIO
- Search: "minio docker compose quickstart"
- Search: "minio create bucket mc client"

### LocalStack (SQS)
- Search: "localstack sqs docker"
- Search: "aws-sdk sqs localstack endpoint"

### BullMQ (Redis queues)
- Search: "bullmq worker queue add job"

### Postgres + pgvector
- Search: "pgvector node pg"

### OCR tooling
- Search: "tesseract.js node examples"
- Search: "pdfjs-dist render page node canvas"

## Things to Note (Common Pitfalls)

- **Shape compatibility**: Make sure local storage returns the same shape as S3 (`{ Body: Buffer }`).
- **Path style**: MinIO usually needs path-style S3 URLs.
- **Queue payloads**: Keep queue message format identical between Redis and SQS.
- **OCR speed**: OCR is slow locally; cap pages with `OCR_MAX_PAGES`.
- **Windows build tools**: `canvas` needs MSVC on Windows. If that is painful, do OCR in Linux or skip OCR locally and use text-only PDFs.

## Migration Checklist (Local -> AWS)

- Switch `.env` values to AWS endpoints.
- Use S3 bucket name and IAM role credentials.
- Switch queue to SQS.
- Update DNS/ALB settings for API.
- Use RDS endpoint for Postgres.

## Suggested Next Steps

1. Create a minimal `storage/local.js` that reads/writes from `./data`.
2. Add `STORAGE_BACKEND` support in `config.js`.
3. Keep Redis queue for now.
4. Add MinIO later if you want S3-like behavior.

If you want, I can review your planned changes before you code them.
