# Financial Document Intelligence Platform (AWS + EC2 + Terraform + Node.js)

This document provides a comprehensive, implementation-ready plan to build a self-hosted financial document intelligence platform for Malaysian finance teams. The design uses AWS, EC2, Terraform, Redis caching, a queue-based worker system, Postgres, and self-hosted LLMs on EC2. The system supports:

- Document ingestion + OCR + parsing
- RAG Q&A with citations (page + bounding boxes)
- Table QA for financial statements
- Summarization on upload
- Batch uploads + comparisons across documents
- Basic web UI
- Auth + multi-tenant data isolation
- Monitoring, metrics, and logging

## 1) Goals and Success Criteria

### Functional goals
- Upload PDFs (annual reports, statements, contracts) and ingest at scale.
- Answer natural language questions with cited pages.
- Compare answers across multiple documents or years.
- Extract table answers from financial statements.
- Provide summaries per document.
- Support BM + EN documents.

### Non-functional goals
- Latency: Q&A response within 5-15s under normal load.
- Scale: batch processing up to 10k documents per tenant.
- Reliability: job processing with retries and dead-letter handling.
- Security: per-tenant isolation; encrypted storage.

## 2) High-Level Architecture

### Core services
- **API Service (Node.js)**: auth, uploads, search, Q&A, batch compare.
- **Ingestion Worker**: OCR + layout parsing + chunking.
- **Indexing Worker**: embeddings + vector index updates.
- **QA Worker**: RAG, citations, answer generation.
- **Summarization Worker**: summary on upload.
- **Table QA Worker**: table extraction + QA.
- **Model Serving**: self-hosted LLM + embedding model.

### AWS components
- **EC2**: API, workers, model serving (GPU).
- **S3**: document storage and OCR artifacts.
- **RDS Postgres**: metadata + pgvector for embeddings.
- **Redis**: caching + optional queue (if not using SQS).
- **SQS**: durable queues for workers (recommended).
- **ALB**: API traffic routing.
- **CloudWatch**: logs, metrics, alarms.
- **VPC**: private subnets, security groups.

## 3) Data Flow

1. **Upload**: user uploads PDF -> API stores in S3, metadata in Postgres.
2. **OCR & Layout**: ingestion worker runs OCR, extracts page text + layout + tables.
3. **Chunking**: split into layout-aware chunks with page + bbox metadata.
4. **Embedding & Index**: embed chunks and store in pgvector.
5. **Summarization**: create executive summary per document.
6. **Q&A**: query -> retrieval -> rerank -> answer + citations.
7. **Batch Compare**: run same query across multiple docs and compare.

## 4) Model Stack (Self-Hosted on EC2)

### OCR + layout
- **OCR**: PaddleOCR or Tesseract + language packs (BM/EN).
- **Layout**: LayoutLMv3 or DocTR for structure tagging.
- **Table extraction**: Camelot/Tabula + table structure model.

### Embeddings
- **Embedding model**: BGE-base or E5-base.

### Reranking
- **Reranker**: BGE reranker or cross-encoder.

### LLM
- **LLM**: Llama 3 or Mistral (7B/8B) with vLLM or TGI.

### Hardware sizing (initial)
- **GPU**: 1x g5.xlarge for inference. Scale to g5.2xlarge if needed.
- **CPU**: c6i.large for API, c6i.large for workers.

## 5) Storage Design

### S3
- Raw uploads: s3://docs/raw/{tenant_id}/{doc_id}.pdf
- OCR outputs: s3://docs/ocr/{tenant_id}/{doc_id}/page_{n}.json
- Tables: s3://docs/tables/{tenant_id}/{doc_id}/tables.json

### Postgres (RDS)
- **Documents**: metadata, status, tenant_id.
- **Chunks**: text, page, bbox, embeddings.
- **Queries**: question, answer, citations.
- **Users/Tenants**: auth, roles.
- **Jobs**: queue metadata.

Use **pgvector** extension for embeddings.

## 6) Queue and Worker Strategy

### Recommended
- **SQS** for reliability and visibility timeout handling.

### Jobs
- `ingest_document`
- `extract_tables`
- `index_embeddings`
- `summarize_document`
- `answer_question`
- `batch_compare`

### Failure handling
- Retry up to 3 times with exponential backoff.
- Dead-letter queue (DLQ) for inspection.

## 7) API Design (Node.js)

### Auth
- JWT-based auth, multi-tenant.

### Endpoints
- `POST /auth/login`
- `POST /documents/upload`
- `GET /documents/{id}`
- `POST /questions`
- `POST /batch-compare`
- `GET /documents/{id}/summary`
- `GET /documents/{id}/tables`

## 8) UI Scope

- Document upload dashboard.
- Document list + status.
- Q&A interface with citations.
- Batch compare view.
- Document summary view.

## 9) Terraform Infrastructure

### Modules
- VPC + subnets + NAT
- ALB + target groups
- EC2 ASG for API and workers
- GPU EC2 instance for models
- RDS Postgres (multi-AZ optional)
- S3 buckets
- SQS queues
- CloudWatch logs + alarms

### IaC Checklist
- All infra versioned in Terraform.
- Parameterize environments (dev/staging/prod).

## 10) Security & Multi-Tenant

- Tenant isolation at DB row-level.
- Per-tenant S3 prefixes.
- TLS for all traffic.
- IAM roles for EC2.
- Audit logs for query + document access.

## 11) Observability

- CloudWatch logs per service.
- Metrics: job latency, queue depth, OCR throughput, LLM response time.
- Alerting: failure rates > 5%.

## 12) Implementation Phases

### Phase 1: Core ingestion + OCR
- Build upload pipeline.
- OCR + chunking.
- Store outputs in Postgres.

### Phase 2: RAG Q&A + citations
- Embedding + pgvector index.
- Retrieval + reranking + LLM answers.
- Citation resolver.

### Phase 3: Summarization + table QA
- Summaries per document.
- Table extraction + QA.

### Phase 4: Batch compare
- Multi-doc queries + delta comparisons.

### Phase 5: UI + auth + tenancy
- Basic web dashboard.
- Auth + multi-tenant isolation.

### Phase 6: Observability + scaling
- Metrics + alarms.
- Autoscaling.

## 13) Verification and Testing

- Unit tests for ingestion and parsing.
- Integration tests for Q&A.
- QA accuracy sampling with ground truth.
- Load testing with 100+ concurrent queries.

## 14) Initial Implementation Checklist

- [ ] Set up Terraform baseline (VPC, EC2, RDS, S3, SQS)
- [ ] Implement API service skeleton
- [ ] Implement ingestion worker
- [ ] Implement OCR + chunking pipeline
- [ ] Add embeddings + pgvector index
- [ ] Add Q&A workflow with citations
- [ ] Add summarization
- [ ] Add table QA
- [ ] Add batch compare
- [ ] Add UI basics
- [ ] Add auth + multi-tenant
- [ ] Add observability

---

If you want code scaffolding next, tell me which service to start with (API, ingestion worker, or model serving).