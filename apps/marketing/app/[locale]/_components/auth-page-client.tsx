"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/app/[locale]/_components/locale-switcher";
import { buildBrowserCallbackURL, normalizeAppReturnTo } from "@/src/auth/routing";
import { getLocalizedPathname, type Locale } from "@/src/i18n/config";

type AuthPageClientProps = {
  config: {
    gatewayURL: string;
    appURL: string;
  };
  mode: "login" | "registration";
};

function parseError(value: unknown, fallback: string): string {
  if (value instanceof Error) {
    return value.message;
  }
  return fallback;
}

async function parseJSON(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
}

export function AuthPageClient({ config, mode }: AuthPageClientProps) {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [otpCode, setOTPCode] = useState("");
  const [otpMode, setOTPMode] = useState<"login" | "registration">(mode);
  const [otpFlowID, setOTPFlowID] = useState("");
  const [otpCSRF, setOTPCSRF] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const { appURL, gatewayURL } = config;
  const isLogin = mode === "login";

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
      setResult(t("messages.logoutSuccess"));
    } catch (error) {
      setResult(t("messages.logoutError", { error: parseError(error, t("messages.unexpectedError")) }));
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
        throw new Error(t("messages.invalidCredentials"));
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
        throw new Error(payload.error ?? t("messages.passwordFallback"));
      }
      setResult(payload.message ?? t("messages.passwordSuccess"));
    } catch (error) {
      setResult(
        isLogin
          ? t("messages.loginError", { error: parseError(error, t("messages.unexpectedError")) })
          : t("messages.registerError", { error: parseError(error, t("messages.unexpectedError")) }),
      );
    } finally {
      setBusy(false);
    }
  }

  async function startOTP(nextMode: "login" | "registration") {
    setBusy(true);
    setResult("");
    try {
      if (!email) {
        throw new Error(t("messages.invalidEmail"));
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
        throw new Error(payload.error ?? t("messages.otpStartFallback"));
      }
      if (!payload.flowId || !payload.csrfToken) {
        throw new Error(t("messages.otpTokensMissing"));
      }
      setOTPMode(nextMode);
      setOTPFlowID(payload.flowId);
      setOTPCSRF(payload.csrfToken);
      setResult(payload.message ?? t("messages.otpSent"));
    } catch (error) {
      setResult(t("messages.otpStartError", { error: parseError(error, t("messages.unexpectedError")) }));
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
        throw new Error(t("messages.otpInvalidState"));
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
        throw new Error(payload.error ?? t("messages.otpVerifyFallback"));
      }
      setResult(payload.message ?? t("messages.otpVerified"));
    } catch (error) {
      setResult(t("messages.otpVerifyError", { error: parseError(error, t("messages.unexpectedError")) }));
    } finally {
      setBusy(false);
    }
  }

  async function loginGoogle(nextMode: "login" | "registration") {
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
        throw new Error(payload.error ?? t("messages.googleFallback"));
      }
      window.location.href = payload.redirectTo;
    } catch (error) {
      setResult(t("messages.googleError", { error: parseError(error, t("messages.unexpectedError")) }));
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-phone">
        <header className="auth-topbar">
          <span className="auth-dot" />
          <p>{t("secureAccess")}</p>
          <div className="auth-topbar-actions">
            <LocaleSwitcher className="auth-locale-switcher" />
            <button className="ghost-btn" disabled={busy} onClick={logoutKratos} type="button">
              {t("logout")}
            </button>
          </div>
        </header>

        <section className="auth-balance-card">
          <p>{t("account")}</p>
          <h1>{isLogin ? t("loginTitle") : t("registerTitle")}</h1>
          <span>{isLogin ? t("loginSubtitle") : t("registerSubtitle")}</span>
        </section>

        <section className="auth-panel">
          <div className="auth-segmented">
            <Link
              aria-current={isLogin ? "page" : undefined}
              className={isLogin ? "is-active" : undefined}
              href={getLocalizedPathname(locale, "/login")}
            >
              {t("loginTab")}
            </Link>
            <Link
              aria-current={!isLogin ? "page" : undefined}
              className={!isLogin ? "is-active" : undefined}
              href={getLocalizedPathname(locale, "/register")}
            >
              {t("registerTab")}
            </Link>
          </div>

          <form className="auth-form" onSubmit={submitPassword}>
            {!isLogin && (
              <label>
                {t("nameLabel")}
                <input autoComplete="name" onChange={(event) => setName(event.target.value)} value={name} />
              </label>
            )}
            <label>
              {t("emailLabel")}
              <input
                autoComplete="email"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label>
              {t("passwordLabel")}
              <input
                autoComplete={isLogin ? "current-password" : "new-password"}
                onChange={(event) => setPassword(event.target.value)}
                type="password"
                value={password}
              />
            </label>
            <button className="primary-btn" disabled={busy} type="submit">
              {isLogin ? t("submitLogin") : t("submitRegister")}
            </button>
          </form>

          <div className="auth-actions">
            <button disabled={busy} onClick={() => startOTP(mode)} type="button">
              {isLogin ? t("otpLogin") : t("otpRegister")}
            </button>
            <button disabled={busy} onClick={() => loginGoogle(mode)} type="button">
              {t("google")}
            </button>
          </div>

          {otpFlowID ? (
            <form className="auth-form otp-form" onSubmit={verifyOTP}>
              <label>
                {t("otpCodeLabel")}
                <input onChange={(event) => setOTPCode(event.target.value)} value={otpCode} />
              </label>
              <button className="primary-btn" disabled={busy} type="submit">
                {t("otpVerify")}
              </button>
            </form>
          ) : null}

          {result ? <pre className="result">{result}</pre> : null}
        </section>
      </section>

      <aside className="auth-side">
        <article className="side-card">
          <h2>{t("sideTitle")}</h2>
          <p>{t("sideDescription")}</p>
        </article>
        <article className="side-card stats">
          <p>{t("endpointLabel")}</p>
          <code>{gatewayURL}</code>
        </article>
      </aside>
    </main>
  );
}
