import React from "react";

export default function Login({ apiBase, setApiBase, onLogin, error }) {
  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">DocIntel MVP</p>
          <h1>Log in to your financial intelligence workspace.</h1>
          <p className="lead">
            Connect with Google to access document Q&A, citations, and dashboards.
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
        </div>
      </header>
      
      {/* main tag is a semantic HTML5 element used to represent the main landmark of a webpage.  */}
      {/* It is intended to contain the primary content of the page that is directly related to the central topic or functionality. */}
      <main className="panel login-panel">
        <h2>Continue with Google</h2>
        <p>We will redirect you to Google and bring you back to the dashboard.</p>
        <button type="button" className="primary" onClick={onLogin}>
          Continue with Google
        </button>
        {error && <p className="error">{error}</p>}
      </main>
    </div>
  );
}
