import React, { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";

const defaultApiBase = "http://localhost:3000";

// This is a protected route wrapper that checks if the user is authenticated 
// before rendering the child component.
function RequireAuth({ auth, children }) {
  if (auth.status === "loading") {
    return (
      <div className="page">
        <main className="panel">
          <h2>Checking your session...</h2>
        </main>
      </div>
    );
  }

  if (!auth.user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  const [apiBase, setApiBaseState] = useState(
    window.localStorage.getItem("apiBase") || defaultApiBase
  );
  const [tenantId, setTenantId] = useState("");
  const [auth, setAuth] = useState({ status: "loading", user: null });
  const [authError, setAuthError] = useState("");

  const setApiBase = useCallback((value) => {
    setApiBaseState(value);
    window.localStorage.setItem("apiBase", value);
  }, []);

  const loadSession = useCallback(async () => {
    setAuth((prev) => ({ ...prev, status: "loading" }));
    setAuthError("");

    try {
      const res = await fetch(`${apiBase}/auth/me`, {
        credentials: "include"
      });

      if (!res.ok) {
        setAuth({ status: "ready", user: null });
        return;
      }

      const data = await res.json();
      setAuth({ status: "ready", user: data });
      setTenantId(data.tenantId || "");
    } catch (err) {
      setAuth({ status: "ready", user: null });
      setAuthError("Unable to reach the API server.");
    }
  }, [apiBase]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  const handleLogin = useCallback(() => {
    window.location.href = `${apiBase}/auth/google`;
  }, [apiBase]);

  const handleLogout = useCallback(async () => {
    await fetch(`${apiBase}/auth/logout`, {
      method: "POST",
      credentials: "include"
    });
    setAuth({ status: "ready", user: null });
  }, [apiBase]);

  const dashboardProps = useMemo(
    () => ({
      apiBase,
      setApiBase,
      tenantId,
      setTenantId,
      user: auth.user,
      onLogout: handleLogout
    }),
    [apiBase, setApiBase, tenantId, auth.user, handleLogout]
  );

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <Login
              apiBase={apiBase}
              setApiBase={setApiBase}
              onLogin={handleLogin}
              error={authError}
            />
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth auth={auth}>
              <Dashboard {...dashboardProps} />
            </RequireAuth>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
