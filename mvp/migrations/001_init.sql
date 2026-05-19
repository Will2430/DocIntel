-- Active: 1778001093290@@localhost@5432@postgres@public
-- Active: 1778000014907@@localhost@5432@postgres@public
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  filename TEXT NOT NULL,
  s3_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS chunks (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  document_id UUID REFERENCES documents(id),
  page_number INT NOT NULL,
  bbox JSONB NOT NULL,
  text TEXT NOT NULL,
  embedding vector(768)
);

CREATE TABLE IF NOT EXISTS qa_queries (
  id UUID PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id),
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  citations JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
