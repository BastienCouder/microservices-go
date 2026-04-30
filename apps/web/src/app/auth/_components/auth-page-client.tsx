"use client";

import { FormEvent, useState } from "react";
import { buildBrowserCallbackURL, normalizeAppReturnTo } from "../auth-routing";

type AuthPageClientProps = {
  config: {
    gatewayURL: string;
    appURL: string;
  };
};

type AuthMode = "login" | "registration";

function parseError(value: unknown): string {
  if (value instanceof Error) {
    return value.message;
  }
  return "unexpected error";
}

async function parseJSON(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
}

export function AuthPageClient({ config }: AuthPageClientProps) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOTPCode] = useState("");
  const [otpMode, setOTPMode] = useState<AuthMode>("login");
  const [otpFlowID, setOTPFlowID] = useState("");
  const [otpCSRF, setOTPCSRF] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const { appURL, gatewayURL } = config;

  function getReturnTo(): string {
    if (typeof window === "undefined") {
      return normalizeAppReturnTo("", appURL);
    }
    const params = new URLSearchParams(window.location.search);
    const resolved = normalizeAppReturnTo(params.get("return_to"), appURL);
    window.sessionStorage.setItem("auth:return_to", resolved);
    return resolved;
  }

  async function logoutKratos() {
    setBusy(true);
    setResult("");
    try {
      const response = await fetch(`${gatewayURL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
      const payload = await parseJSON(response);
      if (!response.ok) {
        throw new Error(JSON.stringify(payload));
      }
      setResult("logout ok, session cookie cleared");
    } catch (error) {
      setResult(`logout error: ${parseError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function submitPassword(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult("");
    try {
      if (!email || !password) {
        throw new Error("invalid email/password");
      }

      const response = await fetch(`${gatewayURL}/auth/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode,
          email,
          name,
          password,
        }),
      });
      const payload = (await parseJSON(response)) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "failed password auth flow");
      }
      setResult(payload.message ?? "opération réussie");
      window.location.href = getReturnTo();
    } catch (error) {
      setResult(`${mode === "login" ? "connexion" : "inscription"} error: ${parseError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function startOTP(nextMode: AuthMode) {
    setBusy(true);
    setResult("");
    try {
      if (!email) {
        throw new Error("invalid email");
      }
      const response = await fetch(`${gatewayURL}/auth/otp/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: nextMode,
          email,
          name,
        }),
      });
      const payload = (await parseJSON(response)) as {
        flowId?: string;
        csrfToken?: string;
        message?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "failed to start otp flow");
      }
      if (!payload.flowId || !payload.csrfToken) {
        throw new Error("missing flowId/csrfToken");
      }
      setOTPMode(nextMode);
      setOTPFlowID(payload.flowId);
      setOTPCSRF(payload.csrfToken);
      setResult(payload.message ?? "otp envoyé");
    } catch (error) {
      setResult(`start otp error: ${parseError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function verifyOTP(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setResult("");
    try {
      if (!otpFlowID || !otpCode || !otpCSRF) {
        throw new Error("missing flow/code/csrf");
      }
      const response = await fetch(`${gatewayURL}/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: otpMode,
          flowId: otpFlowID,
          csrfToken: otpCSRF,
          code: otpCode,
        }),
      });
      const payload = (await parseJSON(response)) as { message?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "failed to verify otp");
      }
      setResult(payload.message ?? "otp validé");
      window.location.href = getReturnTo();
    } catch (error) {
      setResult(`verify otp error: ${parseError(error)}`);
    } finally {
      setBusy(false);
    }
  }

  async function loginGoogle(nextMode: AuthMode) {
    setBusy(true);
    setResult("");
    try {
      const response = await fetch(`${gatewayURL}/auth/oidc/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode: nextMode,
          returnTo: buildBrowserCallbackURL(window.location.origin, getReturnTo()),
        }),
      });
      const payload = (await parseJSON(response)) as { redirectTo?: string; error?: string };
      if (!response.ok || !payload.redirectTo) {
        throw new Error(payload.error ?? "failed google flow");
      }
      window.location.href = payload.redirectTo;
    } catch (error) {
      setResult(`google ${nextMode} error: ${parseError(error)}`);
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-phone">
        <header className="auth-topbar">
          <span className="auth-dot" />
          <p>Secure Access</p>
          <button className="ghost-btn" disabled={busy} onClick={logoutKratos} type="button">
            Logout
          </button>
        </header>

        <section className="auth-balance-card">
          <p>Compte</p>
          <h1>{mode === "login" ? "Connexion" : "Inscription"}</h1>
          <span>{mode === "login" ? "Bienvenue, continue ton flow" : "Crée ton accès en 30 secondes"}</span>
        </section>

        <section className="auth-panel">
          <div className="auth-segmented">
            <button
              className={mode === "login" ? "is-active" : ""}
              disabled={busy}
              onClick={() => setMode("login")}
              type="button"
            >
              Login
            </button>
            <button
              className={mode === "registration" ? "is-active" : ""}
              disabled={busy}
              onClick={() => setMode("registration")}
              type="button"
            >
              Register
            </button>
          </div>

          <form className="auth-form" onSubmit={submitPassword}>
            {mode === "registration" && (
              <label>
                Nom
                <input autoComplete="name" onChange={(event) => setName(event.target.value)} value={name} />
              </label>
            )}
            <label>
              Email
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label>
              Password
              <input
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button className="primary-btn" disabled={busy} type="submit">
              {mode === "login" ? "Se connecter" : "Créer mon compte"}
            </button>
          </form>

          <div className="auth-actions">
            <button disabled={busy} onClick={() => startOTP(mode)} type="button">
              {mode === "login" ? "OTP Email login" : "OTP Email register"}
            </button>
            <button disabled={busy} onClick={() => loginGoogle(mode)} type="button">
              Continuer avec Google
            </button>
          </div>

          {otpFlowID && (
            <form className="auth-form otp-form" onSubmit={verifyOTP}>
              <label>
                Code OTP
                <input onChange={(event) => setOTPCode(event.target.value)} value={otpCode} />
              </label>
              <button className="primary-btn" disabled={busy} type="submit">
                Valider le code
              </button>
            </form>
          )}

          {result && <pre className="result">{result}</pre>}
        </section>
      </section>

      <aside className="auth-side">
        <article className="side-card">
          <h2>Auth only</h2>
          <p>Page dédiée à l’authentification Kratos: login/register unifiés, OTP email et Google OIDC.</p>
        </article>
        <article className="side-card stats">
          <p>Endpoint</p>
          <code>{gatewayURL}</code>
        </article>
      </aside>
    </main>
  );
}
