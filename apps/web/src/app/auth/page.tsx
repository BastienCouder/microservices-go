"use client";

import { FormEvent, useState } from "react";

type KratosFlow = {
  id: string;
  ui?: {
    nodes?: Array<{
      attributes?: {
        name?: string;
        value?: string;
      };
    }>;
  };
};

type KratosLoginResponse = {
  session_token?: string;
};

type KratosRegistrationResponse = {
  identity?: {
    id?: string;
  };
};

function parseError(e: unknown): string {
  if (e instanceof Error) {
    return e.message;
  }
  return "unexpected error";
}

function extractCSRF(flow: KratosFlow): string {
  const nodes = flow.ui?.nodes ?? [];
  for (const node of nodes) {
    if (node.attributes?.name === "csrf_token" && typeof node.attributes.value === "string") {
      return node.attributes.value;
    }
  }
  throw new Error("missing csrf_token in kratos flow");
}

export default function AuthTestPage() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const kratosURL = process.env.NEXT_PUBLIC_KRATOS_URL;
  const gatewayURL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

  async function logoutKratos() {
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL) {
        throw new Error("missing NEXT_PUBLIC_KRATOS_URL");
      }

      const initRes = await fetch(`${kratosURL}/self-service/logout/browser`, {
        headers: {
          Accept: "application/json",
        },
        credentials: "include",
      });
      if (!initRes.ok) {
        throw new Error("failed to initialize logout flow");
      }

      const initPayload = (await initRes.json()) as { logout_url?: string };
      if (!initPayload.logout_url) {
        throw new Error("missing logout_url");
      }

      const completeRes = await fetch(initPayload.logout_url, {
        method: "GET",
        credentials: "include",
      });
      if (!completeRes.ok) {
        throw new Error("failed to complete logout flow");
      }

      setSessionToken("");
      setResult("logout ok, session cookie cleared. You can now do a fresh login.");
    } catch (e) {
      setResult(`logout error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function register(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL || !email || !password) {
        throw new Error("missing NEXT_PUBLIC_KRATOS_URL or invalid email/password");
      }

      const initRes = await fetch(`${kratosURL}/self-service/registration/browser`, {
        headers: {
          Accept: "application/json",
        },
        credentials: "include",
      });
      if (!initRes.ok) {
        throw new Error("failed to initialize registration flow");
      }
      const flow = (await initRes.json()) as KratosFlow;
      const csrfToken = extractCSRF(flow);

      const submitRes = await fetch(`${kratosURL}/self-service/registration?flow=${flow.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          method: "password",
          csrf_token: csrfToken,
          traits: {
            email,
            name,
          },
          password,
        }),
      });

      const payload = (await submitRes.json()) as KratosRegistrationResponse;
      if (!submitRes.ok) {
        throw new Error(JSON.stringify(payload));
      }

      setResult(`registration ok, identity_id=${payload.identity?.id ?? "unknown"}`);
    } catch (e) {
      setResult(`registration error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function login(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL || !email || !password) {
        throw new Error("missing NEXT_PUBLIC_KRATOS_URL or invalid email/password");
      }

      const initRes = await fetch(`${kratosURL}/self-service/login/browser?refresh=true`, {
        headers: {
          Accept: "application/json",
        },
        credentials: "include",
      });
      if (!initRes.ok) {
        throw new Error("failed to initialize login flow");
      }
      const flow = (await initRes.json()) as KratosFlow;
      const csrfToken = extractCSRF(flow);

      const submitRes = await fetch(`${kratosURL}/self-service/login?flow=${flow.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          method: "password",
          csrf_token: csrfToken,
          identifier: email,
          password,
        }),
      });

      const payload = (await submitRes.json()) as KratosLoginResponse;
      if (!submitRes.ok) {
        throw new Error(JSON.stringify(payload));
      }

      if (payload.session_token) {
        setSessionToken(payload.session_token);
        setResult("login ok, session_token received");
        return;
      }

      setResult("login ok (cookie session active). No session_token returned in browser flow.");
    } catch (e) {
      setResult(`login error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function testAuthService() {
    setBusy(true);
    setResult("");
    try {
      if (!gatewayURL) {
        throw new Error("missing NEXT_PUBLIC_API_GATEWAY_URL");
      }
      const headers: Record<string, string> = {};
      if (sessionToken) {
        headers["X-Session-Token"] = sessionToken;
      }

      const authRes = await fetch(`${gatewayURL}/auth/validate`, {
        method: "GET",
        credentials: "include",
        headers,
      });
      const authPayload = await authRes.json();

      const meRes = await fetch(`${gatewayURL}/auth/me`, {
        method: "GET",
        credentials: "include",
        headers,
      });
      const mePayload = await meRes.json();
      setResult(
        `auth status=${authRes.status}\n${JSON.stringify(authPayload, null, 2)}\n\nauth/me status=${meRes.status}\n${JSON.stringify(mePayload, null, 2)}`,
      );
    } catch (e) {
      setResult(`auth-service error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-page">
      <h1>Auth Test Bench</h1>
      <p>Kratos: {kratosURL ?? "NOT SET"} | Gateway: {gatewayURL ?? "NOT SET"}</p>

      <form className="card" onSubmit={register}>
        <h2>Register</h2>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </label>
        <label>
          Password
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        </label>
        <button disabled={busy} type="submit">
          Register
        </button>
      </form>

      <form className="card" onSubmit={login}>
        <h2>Login</h2>
        <button disabled={busy} type="submit">
          Login
        </button>
      </form>

      <div className="card">
        <label>
          Session Token
          <textarea value={sessionToken} onChange={(e) => setSessionToken(e.target.value.trim())} rows={4} />
        </label>
        <button disabled={busy} onClick={logoutKratos} type="button">
          Logout Kratos (force fresh login)
        </button>
        <button disabled={busy} onClick={testAuthService} type="button">
          Test Auth via Gateway
        </button>
      </div>

      <pre className="result">{result}</pre>
    </main>
  );
}
