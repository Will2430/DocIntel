# Redis + Queue + SSE (Job ID) Implementation Plan

This is a step-by-step plan to add **job-based streaming** with Redis and SSE. It is designed for your current MVP stack (Node.js + Redis + workers) and assumes you want:

- `POST /questions` returns a **jobId** immediately
- A **worker** runs the LLM call
- Tokens are **streamed via SSE** using Redis pub/sub
- The client can **reconnect** using the same jobId

This plan is deliberately detailed so you can implement it even if you are starting from zero.

---

## 1) Core Decisions (Make These First)

### 1.1 Redis client choice

**Use `ioredis`**.

Reason:
- `bullmq` already uses `ioredis` internally.
- `ioredis` supports **Pub/Sub**, **Streams**, and **good reconnection defaults**.

Install:

```
npm install ioredis
```

### 1.2 Queue or no queue?

You said you want **Job ID + SSE**. That implies a queue so that:

- API can return quickly
- Worker handles LLM execution
- Scaling is easier
- Jobs can be retried

**Recommendation:** Keep your existing queue (BullMQ). Use Redis for both queue and pub/sub.

### 1.3 Should you pass session ID?

No. You already have authentication (JWT cookie) and `tenantId` in `req.user`.

- Use `req.user.tenantId` for authorization.
- Store `tenantId` in the job payload.
- Use `jobId` as the stream channel key.

Session IDs are not needed for the streaming channel.

---

## 2) High-Level Architecture

```
Client
  | POST /questions -> returns jobId
  | GET  /questions/stream?jobId=... (SSE)

API
  | enqueue jobId -> queue
  | opens Redis subscriber for SSE

Worker
  | dequeues job
  | calls LLM (stream=true)
  | publishes tokens to Redis
  | publishes DONE to Redis

Redis
  | BullMQ queues
  | Pub/Sub channel: job:<jobId>
```

---

## 3) Data Model (Minimal)

You can do this with **Redis only**, or add a DB table. For MVP, Redis is enough.

### 3.1 Redis keys

- `job:<jobId>`: Pub/Sub channel (tokens)
- `job:<jobId>:status`: `queued | running | done | error`
- `job:<jobId>:answer`: final answer (optional)
- `job:<jobId>:citations`: JSON (optional)

Set expiry (TTL) so old jobs disappear:

- `EXPIRE job:<jobId>:status 3600`
- `EXPIRE job:<jobId>:answer 3600`

### 3.2 Optional database table

Add later if you want auditing or history.

Columns:
- `id` (jobId)
- `tenant_id`
- `status`
- `created_at`, `completed_at`
- `answer`, `citations`

---

## 4) API Endpoint Design

### 4.1 POST /questions

Responsibilities:
- Validate input
- Derive `tenantId` from auth
- Generate `jobId`
- Store job status in Redis
- Enqueue job payload
- Return `{ jobId }`

Payload to queue:

```
{
  jobId,
  tenantId,
  question,
  documentIds
}
```

### 4.2 GET /questions/stream?jobId=...

Responsibilities:
- Validate `jobId`
- Check user is allowed to access job
- Subscribe to `job:<jobId>`
- Stream tokens to client
- Handle done / error

SSE headers:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

Send a job event immediately:

```
event: job
id: <jobId>
data: {"jobId":"..."}

```

---

## 5) Worker Flow (LLM Streaming)

Steps:

1. Dequeue job
2. Update Redis: `job:<jobId>:status = running`
3. Build RAG context (retriever)
4. Call LLM with `stream=true`
5. For each token chunk:
   - `PUBLISH job:<jobId> <token>`
6. When done:
   - `PUBLISH job:<jobId> [DONE]`
   - store final answer / citations in Redis
   - update status

---

## 6) Redis Pub/Sub Implementation Details

You must use **two Redis connections**:

- One for **publishing** (worker)
- One for **subscribing** (SSE route)

Example structure:

```
const Redis = require("ioredis");

const redis = new Redis(process.env.REDIS_URL);       // general use
const pub = new Redis(process.env.REDIS_URL);         // worker publisher
const sub = new Redis(process.env.REDIS_URL);         // SSE subscriber
```

### Subscription handling

- `sub.subscribe(channel)`
- `sub.on("message", (channel, message) => { ... })`

When client disconnects:

- `req.on("close", ...)` then `sub.unsubscribe(channel)`

---

## 7) SSE Event Format (Recommended)

Use simple JSON tokens. Example:

```
// token
res.write(`data: ${JSON.stringify({ token })}\n\n`)

// done
res.write(`event: done\ndata: {}\n\n`)
```

Add heartbeat every 15s:

```
res.write(`: ping\n\n`)
```

---

## 8) Reconnect + Resume (Important)

If user reconnects:

1) Check `job:<jobId>:status`
2) If `done`, return final answer from Redis immediately
3) If `running`, re-subscribe and continue streaming

Optional: store all chunks in Redis list:

- `LPUSH job:<jobId>:tokens <token>`

When reconnecting, replay tokens and continue.

---

## 9) Security and Tenancy

Make sure users can only access their own jobs:

- Store `tenantId` in Redis at job creation
- Check `req.user.tenantId === storedTenantId`

Never allow arbitrary jobId access without validation.

---

## 10) Concrete File Changes (Map)

Suggested files to update/add (do in this order):

1) **Queue and Redis clients**
   - Create `src/redis/index.js` with `redis`, `pub`, `sub` clients

2) **POST /questions**
   - Update `src/routes/questions.js`
   - Return `{ jobId }`

3) **GET /questions/stream**
   - Add SSE route in `src/routes/questions.js`

4) **Worker**
   - Update `src/workers/qaWorker.js` to publish tokens

5) **UI**
   - Start SSE in dashboard after jobId is received

---

## 11) How to Start (Very Practical Steps)

1) Add `ioredis` dependency
2) Create Redis client module with `pub` and `sub`
3) Add jobId return in `POST /questions`
4) Add SSE route and test with curl
5) Update worker to publish tokens
6) Update UI to listen to SSE

---

## 12) Example Test Commands

### Start SSE stream (curl)

```
curl -N "http://localhost:3000/questions/stream?jobId=<jobId>"
```

### Publish test token (in node repl)

```
redis.publish("job:<jobId>", "hello")
```

---

## 13) Documentation to Read

### Redis and Pub/Sub
- ioredis: https://github.com/redis/ioredis
- Redis Pub/Sub: https://redis.io/docs/latest/develop/interact/pubsub/

### SSE in Express
- MDN SSE overview: https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events

### BullMQ (queue)
- BullMQ: https://docs.bullmq.io/

---

## 14) Common Mistakes to Avoid

- Using one Redis connection for both queue + subscribe
- Forgetting SSE headers (won't stream)
- Not handling disconnect cleanup (memory leaks)
- Not setting job TTL (Redis grows forever)
- Not validating jobId ownership (security risk)

---

## 15) Final Checklist

- [ ] `ioredis` installed
- [ ] Redis clients created (`pub`, `sub`)
- [ ] `POST /questions` returns `jobId`
- [ ] SSE route streams tokens
- [ ] Worker publishes tokens
- [ ] UI listens and renders
- [ ] Job status stored and expiring

---

If you want, I can review your first implementation before you run it.
