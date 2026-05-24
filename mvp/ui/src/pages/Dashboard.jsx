import React, { useEffect, useMemo, useRef, useState } from "react";

export default function Dashboard({
  apiBase,
  setApiBase,
  tenantId,
  setTenantId,
  user,
  onLogout
}) {
  const [uploading, setUploading] = useState(false);
  const [docIds, setDocIds] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [citations, setCitations] = useState([]);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");
  const [askStatus, setAskStatus] = useState("idle");
  const eventSourceRef = useRef(null);
  const streamActiveRef = useRef(false);
  const doneRef = useRef(false);

  const docIdInput = useMemo(() => docIds.join(","), [docIds]);

  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  function closeStream() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    streamActiveRef.current = false;
  }

  async function handleUpload() {
    if (!selectedFile) {
      setError("Please choose a PDF to upload.");
      return;
    }

    if (!tenantId) {
      setError("Missing tenant ID.");
      return;
    }

    setError("");
    setUploading(true);

    try {
      const form = new FormData();
      form.append("file", selectedFile);

      const res = await fetch(`${apiBase}/documents/upload`, {
        method: "POST",
        headers: {
          "x-tenant-id": tenantId
        },
        body: form
      });

      if (!res.ok) {
        throw new Error(`Upload failed (${res.status})`);
      }

      const data = await res.json();
      setDocIds((prev) => [...prev, data.id]);
      setSelectedFile(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleAsk() {
    if (!question.trim()) {
      setError("Enter a question.");
      return;
    }

    if (!tenantId) {
      setError("Missing tenant ID.");
      return;
    }

    if (docIds.length === 0) {
      setError("Upload at least one document first.");
      return;
    }

    setError("");
    setAnswer("");
    setCitations([]);
    setAskStatus("queued");

    closeStream();

    const res = await fetch(`${apiBase}/questions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-tenant-id": tenantId
      },
      credentials: "include",
      body: JSON.stringify({ question, documentIds: docIds })
    });

    if (!res.ok) {
      setError(`Question failed (${res.status})`);
      return;
    }

    const data = await res.json();
    if (!data.jobId) {
      setError("Job ID missing from response.");
      setAskStatus("idle");
      return;
    }

    setJobId(data.jobId);
    setAskStatus("streaming");
    streamActiveRef.current = true;
    doneRef.current = false;

    const streamUrl = `${apiBase}/questions/${data.jobId}/stream`;
    const eventSource = new EventSource(streamUrl, { withCredentials: true });
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("status", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.status) {
          setAskStatus(payload.status);
        }
      } catch (err) {
        // Ignore malformed status messages.
      }
    });

    // done here referes to the event type that is publish in the pub channel when 
    // the worker finishes processing the question, this is different from the status updates that are also sent by the worker
    
    // this handler is for setAns is the final authoritative state update for the answer and citations, 
    // as it is triggered by the "done" event which indicates that the worker has completed processing and has sent the final result, 
    // while the incremental tokens are just intermediate updates that may not represent the complete or final answer
    eventSource.addEventListener("done", (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (payload.answer) {
          setAnswer(payload.answer);
        }
        setCitations(payload.citations || []);
      } catch (err) {
        setError("Failed to parse completion payload.");
      }

      setAskStatus("done");
      doneRef.current = true;
      closeStream();
    });

    // this is the message handler responsible for handling the incremental tokens sent by the worker
    eventSource.onmessage = (event) => {
      let payload;
      try {
        payload = JSON.parse(event.data);
      } catch (err) {
        setAnswer((prev) => `${prev}${event.data}`);
        return;
      }

      if (payload.type === "token" && payload.token) {
        setAnswer((prev) => `${prev}${payload.token}`);
      }
    };

    eventSource.addEventListener("error", () => {
      if (doneRef.current) {
        return;
      }
      if (!streamActiveRef.current) {
        return;
      }

      setError("Stream disconnected. Try asking again.");
      setAskStatus("idle");
      closeStream();
    });
  }

  function handleDocIdsChange(event) {
    const value = event.target.value;
    const parts = value.split(",").map((item) => item.trim()).filter(Boolean);
    setDocIds(parts);
  }

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">DocIntel MVP</p>
          <h1>Search financial PDFs like a forensic analyst.</h1>
          <p className="lead">
            Upload a report, ask a question, and get citations with page-level proof.
          </p>
        </div>
        <div className="hero-card">
          <label>
            API base URL
            <input
              value={apiBase}
              onChange={(event) => setApiBase(event.target.value)}
              placeholder="http://localhost:3000"
            />
          </label>
          <label>
            Tenant ID
            <input
              value={tenantId}
              onChange={(event) => setTenantId(event.target.value)}
              placeholder="tenant-id"
            />
          </label>
          <div className="stack">
            <p className="muted">Signed in as</p>
            <strong>{user?.email}</strong>
          </div>
          <button type="button" className="ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <h2>Upload a document</h2>
          <p>PDF files only. You can upload multiple docs.</p>

          <div className="upload-row">
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setSelectedFile(event.target.files[0])}
            />
            <button type="button" onClick={handleUpload} disabled={uploading}>
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>

          <label className="block">
            Document IDs (comma-separated)
            <input
              value={docIdInput}
              onChange={handleDocIdsChange}
              placeholder="doc-id-1, doc-id-2"
            />
          </label>
        </section>

        <section className="panel">
          <h2>Ask a question</h2>
          <p>Ask about net profit, cash flow, or any KPI.</p>

          <textarea
            rows={4}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What was the net profit in 2023?"
          />

          <button type="button" onClick={handleAsk} className="primary">
            Ask
          </button>

          {jobId && (
            <p className="muted">Job ID: {jobId} · Status: {askStatus}</p>
          )}

          {error && <p className="error">{error}</p>}
        </section>

        <section className="panel wide">
          <h2>Answer</h2>
          <div className="answer">
            {answer || "No answer yet."}
          </div>

          <h3>Citations</h3>
          {citations.length === 0 ? (
            <p className="muted">No citations returned.</p>
          ) : (
            <div className="citations">
              {citations.map((cite, index) => (
                <div key={`${cite.documentId}-${index}`} className="citation">
                  <p>Doc: {cite.documentId}</p>
                  <p>Page: {cite.page}</p>
                  <p>Score: {Number(cite.score || 0).toFixed(3)}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
