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
  const [otpCode, setOTPCode] = useState("");
  const [otpMode, setOTPMode] = useState<"login" | "registration">("login");
  const [otpFlowID, setOTPFlowID] = useState("");
  const [otpCSRF, setOTPCSRF] = useState("");
  const [sessionToken, setSessionToken] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);
  const kratosURL = process.env.NEXT_PUBLIC_KRATOS_URL;
  const gatewayURL = process.env.NEXT_PUBLIC_API_GATEWAY_URL;

  async function initFlow(kind: "login" | "registration"): Promise<KratosFlow> {
    if (!kratosURL) {
      throw new Error("missing NEXT_PUBLIC_KRATOS_URL");
    }
    const path =
      kind === "login"
        ? `${kratosURL}/self-service/login/browser?refresh=true`
        : `${kratosURL}/self-service/registration/browser`;
    const initRes = await fetch(path, {
      headers: { Accept: "application/json" },
      credentials: "include",
    });
    if (!initRes.ok) {
      throw new Error(`failed to initialize ${kind} flow`);
    }
    return (await initRes.json()) as KratosFlow;
  }

  async function logoutKratos() {
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL) {
        throw new Error("missing NEXT_PUBLIC_KRATOS_URL");
      }
      const initRes = await fetch(`${kratosURL}/self-service/logout/browser`, {
        headers: { Accept: "application/json" },
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
      setResult("logout ok, session cookie cleared");
    } catch (e) {
      setResult(`logout error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function registerPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL || !email || !password) {
        throw new Error("missing NEXT_PUBLIC_KRATOS_URL or invalid email/password");
      }
      const flow = await initFlow("registration");
      const csrfToken = extractCSRF(flow);
      const submitRes = await fetch(`${kratosURL}/self-service/registration?flow=${flow.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          method: "password",
          csrf_token: csrfToken,
          traits: { email, name },
          password,
        }),
      });
      const payload = (await submitRes.json()) as KratosRegistrationResponse;
      if (!submitRes.ok) {
        throw new Error(JSON.stringify(payload));
      }
      setResult(`registration(password) ok, identity_id=${payload.identity?.id ?? "unknown"}`);
    } catch (e) {
      setResult(`registration(password) error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loginPassword(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL || !email || !password) {
        throw new Error("missing NEXT_PUBLIC_KRATOS_URL or invalid email/password");
      }
      const flow = await initFlow("login");
      const csrfToken = extractCSRF(flow);
      const submitRes = await fetch(`${kratosURL}/self-service/login?flow=${flow.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
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
      }
      setResult("login(password) ok");
    } catch (e) {
      setResult(`login(password) error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function startOTP(kind: "login" | "registration") {
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL || !email) {
        throw new Error("missing NEXT_PUBLIC_KRATOS_URL or invalid email");
      }
      const flow = await initFlow(kind);
      const csrfToken = extractCSRF(flow);
      const endpoint = `${kratosURL}/self-service/${kind}?flow=${flow.id}`;
      const payload =
        kind === "login"
          ? { method: "code", csrf_token: csrfToken, identifier: email }
          : { method: "code", csrf_token: csrfToken, traits: { email, name } };
      const sendRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const body = (await sendRes.json()) as KratosFlow;
      if (!sendRes.ok) {
        throw new Error(JSON.stringify(body));
      }
      setOTPMode(kind);
      setOTPFlowID(body.id);
      setOTPCSRF(extractCSRF(body));
      setResult(`otp sent for ${kind}. Check your email and submit code.`);
    } catch (e) {
      setResult(`start otp error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOTP(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL || !otpFlowID || !otpCode || !otpCSRF) {
        throw new Error("missing flow/code/csrf");
      }
      const endpoint = `${kratosURL}/self-service/${otpMode}?flow=${otpFlowID}`;
      const submitRes = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        credentials: "include",
        body: JSON.stringify({
          method: "code",
          csrf_token: otpCSRF,
          code: otpCode,
        }),
      });
      const payload = (await submitRes.json()) as KratosLoginResponse | KratosRegistrationResponse;
      if (!submitRes.ok) {
        throw new Error(JSON.stringify(payload));
      }
      if ("session_token" in payload && payload.session_token) {
        setSessionToken(payload.session_token);
      }
      setResult(`${otpMode}(code) ok`);
    } catch (e) {
      setResult(`verify otp error: ${parseError(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loginGoogle(kind: "login" | "registration") {
    setBusy(true);
    setResult("");
    try {
      if (!kratosURL) {
        throw new Error("missing NEXT_PUBLIC_KRATOS_URL");
      }
      const flow = await initFlow(kind);
      window.location.href = `${kratosURL}/self-service/methods/oidc/auth/google?flow=${flow.id}`;
    } catch (e) {
      setResult(`google ${kind} error: ${parseError(e)}`);
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

      <form className="card" onSubmit={registerPassword}>
        <h2>Register (Password)</h2>
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
          Register Password
        </button>
        <button disabled={busy} type="button" onClick={() => loginGoogle("registration")}>
          Register with Google
        </button>
        <button disabled={busy} type="button" onClick={() => startOTP("registration")}>
          Register with Email OTP
        </button>
      </form>

      <form className="card" onSubmit={loginPassword}>
        <h2>Login</h2>
        <button disabled={busy} type="submit">
          Login Password
        </button>
        <button disabled={busy} type="button" onClick={() => loginGoogle("login")}>
          Login with Google
        </button>
        <button disabled={busy} type="button" onClick={() => startOTP("login")}>
          Login with Email OTP
        </button>
      </form>

      <form className="card" onSubmit={verifyOTP}>
        <h2>Verify OTP ({otpMode})</h2>
        <label>
          OTP Code
          <input value={otpCode} onChange={(e) => setOTPCode(e.target.value)} />
        </label>
        <button disabled={busy} type="submit">
          Verify OTP
        </button>
      </form>

      <div className="card">
        <label>
          Session Token
          <textarea value={sessionToken} onChange={(e) => setSessionToken(e.target.value.trim())} rows={4} />
        </label>
        <button disabled={busy} onClick={logoutKratos} type="button">
          Logout Kratos
        </button>
        <button disabled={busy} onClick={testAuthService} type="button">
          Test Auth via Gateway
        </button>
      </div>

      <pre className="result">{result}</pre>
    </main>
  );
}
