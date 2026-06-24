"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { KRATOS_BROWSER_PROXY_PATH } from "@/src/auth/routing";
import { getLocalizedPathname, type Locale } from "@/src/i18n/config";
import { AnimatedWave } from "./animated-wave";

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
    <main className="relative grid h-[calc(100vh-5rem)] place-items-center overflow-hidden bg-background p-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <AnimatedWave />
      </div>

      <section className="relative z-10 w-full max-w-md rounded-xl border bg-background/90 p-8">
        <header className="mb-8 space-y-2 text-center">
          <p className="text-sm font-medium text-muted-foreground">
            {strings.secureAccess}
          </p>

          <h1 className="text-3xl font-semibold tracking-tight">
            {strings.title}
          </h1>

          <p className="text-sm leading-6 text-muted-foreground">
            {strings.subtitle}
          </p>
        </header>

        <div className="space-y-6">
          <section className="space-y-3">
            <p className="text-sm font-medium leading-none">
              {strings.detailsLabel}
            </p>

            <p className="whitespace-pre-wrap rounded-lg border bg-muted px-3 py-2 text-sm leading-6 text-muted-foreground">
              {resolvedMessage}
            </p>
          </section>

          {errorId ? (
            <section className="space-y-2">
              <p className="text-sm font-medium leading-none">
                {strings.errorIdLabel}
              </p>

              <p className="truncate rounded-lg border bg-background px-3 py-2 font-mono text-xs text-muted-foreground">
                {errorId}
              </p>
            </section>
          ) : null}

          <div className="space-y-3">
            <Button asChild className="w-full">
              <Link href={getLocalizedPathname(locale, "/login")}>
                {strings.retryLogin}
              </Link>
            </Button>

            <Button asChild className="w-full" variant="outline">
              <Link href={getLocalizedPathname(locale, "/register")}>
                {strings.retryRegister}
              </Link>
            </Button>

            <Button asChild className="w-full" variant="ghost">
              <Link href={getLocalizedPathname(locale, "/")}>
                {strings.backHome}
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
