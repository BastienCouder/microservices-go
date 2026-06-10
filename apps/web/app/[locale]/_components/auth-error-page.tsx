"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LocaleSwitcher } from "@/app/[locale]/_components/locale-switcher";
import { KRATOS_BROWSER_PROXY_PATH } from "@/src/auth/routing";
import { getLocalizedPathname, type Locale } from "@/src/i18n/config";

type AuthErrorPageStrings = {
  secureAccess: string;
  title: string;
  subtitle: string;
  detailsLabel: string;
  genericReason: string;
  loadingReason: string;
  unavailableReason: string;
  errorIdLabel: string;
  retryLogin: string;
  retryRegister: string;
  backHome: string;
};

type AuthErrorPageProps = {
  locale: Locale;
  errorId?: string;
  fallbackMessage?: string;
  strings: AuthErrorPageStrings;
};

function extractErrorMessage(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const record = payload as Record<string, unknown>;
  const errorValue = record.error;
  if (errorValue && typeof errorValue === "object") {
    const errorRecord = errorValue as Record<string, unknown>;
    const direct =
      typeof errorRecord.reason === "string"
        ? errorRecord.reason
        : typeof errorRecord.message === "string"
          ? errorRecord.message
          : typeof errorRecord.debug === "string"
            ? errorRecord.debug
            : "";
    if (direct.trim() !== "") {
      return direct.trim();
    }
  }

  const direct =
    typeof record.reason === "string"
      ? record.reason
      : typeof record.message === "string"
        ? record.message
        : typeof record.error_description === "string"
          ? record.error_description
          : "";

  return direct.trim();
}

export function AuthErrorPage({ locale, errorId, fallbackMessage, strings }: AuthErrorPageProps) {
  const [message, setMessage] = useState(fallbackMessage?.trim() || "");
  const [loading, setLoading] = useState(Boolean(errorId) && !fallbackMessage?.trim());

  useEffect(() => {
    const resolvedErrorId = errorId?.trim();
    if (!resolvedErrorId || fallbackMessage?.trim()) {
      return;
    }

    let cancelled = false;
    const currentErrorId = resolvedErrorId;

    async function loadError(): Promise<void> {
      try {
        const response = await fetch(
          `${KRATOS_BROWSER_PROXY_PATH}/self-service/errors?id=${encodeURIComponent(currentErrorId)}`,
          {
            cache: "no-store",
            credentials: "include",
          },
        );
        const payload = (await response.json()) as unknown;
        const nextMessage = extractErrorMessage(payload);

        if (!cancelled) {
          setMessage(nextMessage || strings.unavailableReason);
        }
      } catch {
        if (!cancelled) {
          setMessage(strings.unavailableReason);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadError();

    return () => {
      cancelled = true;
    };
  }, [errorId, fallbackMessage, strings.unavailableReason]);

  const resolvedMessage = loading ? strings.loadingReason : message || strings.genericReason;

  return (
    <main className="auth-shell">
      <section className="auth-phone">
        <header className="auth-topbar">
          <span className="auth-dot" />
          <p>{strings.secureAccess}</p>
          <div className="auth-topbar-actions">
            <LocaleSwitcher className="auth-locale-switcher" />
          </div>
        </header>

        <section className="auth-balance-card">
          <p>{strings.secureAccess}</p>
          <h1>{strings.title}</h1>
          <span>{strings.subtitle}</span>
        </section>

        <section className="auth-panel">
          <p>{strings.detailsLabel}</p>
          <pre className="result">{resolvedMessage}</pre>
          {errorId ? (
            <div className="auth-form">
              <label>
                {strings.errorIdLabel}
                <input readOnly value={errorId} />
              </label>
            </div>
          ) : null}
          <div className="auth-actions">
            <Link className="primary-btn text-center" href={getLocalizedPathname(locale, "/login")}>
              {strings.retryLogin}
            </Link>
            <Link
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-[color:color-mix(in_srgb,var(--foreground)_82%,white)]"
              href={getLocalizedPathname(locale, "/register")}
            >
              {strings.retryRegister}
            </Link>
            <Link
              className="rounded-xl border border-black/10 bg-white px-3 py-2 text-center text-[color:color-mix(in_srgb,var(--foreground)_82%,white)]"
              href={getLocalizedPathname(locale, "/")}
            >
              {strings.backHome}
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}
