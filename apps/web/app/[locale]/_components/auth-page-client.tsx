"use client";

import { FormEvent, useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { buildBrowserCallbackURL, normalizeAppReturnTo } from "@/src/auth/routing";
import {
  clearAuthReturnTo,
  readAuthReturnTo,
  storeAuthReturnTo,
} from "@/src/auth/browser-intent";
import { type Locale } from "@/src/i18n/config";
import { AnimatedWave } from "./animated-wave";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AuthPageClientProps = {
  config: {
    gatewayURL: string;
    appURL: string;
  };
  mode: "login" | "registration";
};

type APIErrorPayload = {
  error?: {
    message?: string;
  };
};

type APISuccessEnvelope<T> = {
  success?: boolean;
  data?: T;
};

function parseError(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

async function parseJSON(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
}

function unwrapSuccessData<T>(payload: unknown): T {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as APISuccessEnvelope<T>).data as T;
  }

  return payload as T;
}

function readAPIErrorMessage(payload: unknown): string | undefined {
  if (!payload || typeof payload !== "object") {
    return undefined;
  }

  return (payload as APIErrorPayload).error?.message;
}

function GoogleLogo() {
  return (
    <svg
      aria-hidden="true"
      className="h-5 w-5 shrink-0"
      viewBox="0 0 24 24"
    >
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

export function AuthPageClient({ config, mode }: AuthPageClientProps) {
  const t = useTranslations("auth");
  const locale = useLocale() as Locale;

  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [otpCode, setOTPCode] = useState("");
  const [otpMode, setOTPMode] = useState<"login" | "registration">(mode);
  const [otpFlowID, setOTPFlowID] = useState("");
  const [otpCSRF, setOTPCSRF] = useState("");
  const [result, setResult] = useState("");
  const [busy, setBusy] = useState(false);

  const { appURL, gatewayURL } = config;
  const isLogin = mode === "login";

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentURL = new URL(window.location.href);
    const rawReturnTo = currentURL.searchParams.get("return_to");
    if (!rawReturnTo) {
      return;
    }

    const resolved = normalizeAppReturnTo(rawReturnTo, getDefaultReturnTo(), {
      allowedURLs: [appURL, window.location.origin],
    });
    storeAuthReturnTo(resolved);
    currentURL.searchParams.delete("return_to");
    window.history.replaceState({}, "", currentURL.toString());
  }, [appURL, locale]);

  function getDefaultReturnTo(): string {
    if (typeof window === "undefined") {
      return appURL;
    }

    return `${window.location.origin}/${locale === "fr" ? "" : `${locale}/`}#pricing`;
  }

  function getReturnTo(): string {
    if (typeof window === "undefined") {
      return normalizeAppReturnTo("", appURL);
    }

    const storedReturnTo = readAuthReturnTo();
    if (storedReturnTo) {
      return storedReturnTo;
    }

    const params = new URLSearchParams(window.location.search);
    const resolved = normalizeAppReturnTo(
      params.get("return_to"),
      getDefaultReturnTo(),
      { allowedURLs: [appURL, window.location.origin] },
    );

    storeAuthReturnTo(resolved);

    return resolved;
  }

  async function startOTP(event: FormEvent) {
    event.preventDefault();
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
          mode,
          email,
          name,
        }),
      });

      const payload = await parseJSON(response);
      const data = unwrapSuccessData<{
        flowId?: string;
        csrfToken?: string;
        message?: string;
      }>(payload);

      if (!response.ok) {
        throw new Error(readAPIErrorMessage(payload) ?? t("messages.otpStartFallback"));
      }

      if (!data.flowId || !data.csrfToken) {
        throw new Error(t("messages.otpTokensMissing"));
      }

      setOTPMode(mode);
      setOTPFlowID(data.flowId);
      setOTPCSRF(data.csrfToken);
      setResult(data.message ?? t("messages.otpSent"));
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

      const payload = await parseJSON(response);
      const data = unwrapSuccessData<{
        message?: string;
      }>(payload);

      if (!response.ok) {
        throw new Error(readAPIErrorMessage(payload) ?? t("messages.otpVerifyFallback"));
      }

      setResult(data.message ?? t("messages.otpVerified"));
      const returnTo = getReturnTo();
      clearAuthReturnTo();
      window.location.replace(returnTo);
    } catch (error) {
      setResult(t("messages.otpVerifyError", { error: parseError(error, t("messages.unexpectedError")) }));
    } finally {
      setBusy(false);
    }
  }

  async function loginGoogle() {
    setBusy(true);
    setResult("");

    try {
      const response = await fetch(`${gatewayURL}/auth/oidc/google`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          mode,
          returnTo: buildBrowserCallbackURL(window.location.origin),
        }),
      });

      const payload = await parseJSON(response);
      const data = unwrapSuccessData<{
        redirectTo?: string;
      }>(payload);

      if (!response.ok || !data.redirectTo) {
        throw new Error(readAPIErrorMessage(payload) ?? t("messages.googleFallback"));
      }

      window.location.replace(data.redirectTo);
    } catch (error) {
      setResult(t("messages.googleError", { error: parseError(error, t("messages.unexpectedError")) }));
      setBusy(false);
    }
  }

  return (
    <main className="relative grid h-[calc(100vh-5rem)] place-items-center overflow-hidden bg-background p-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <AnimatedWave />
      </div>

      <section className="relative z-10 w-full max-w-md rounded-xl border bg-background/90 p-8">
        <header className="mb-8 space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Connexion
          </h1>

          <p className="text-sm leading-6 text-muted-foreground">
            Connectez-vous ou créez votre compte.
          </p>
        </header>

        <div className="space-y-6">
          <Button
            className="flex w-full items-center justify-center gap-3"
            disabled={busy}
            onClick={loginGoogle}
            type="button"
            variant="outline"
          >
            <GoogleLogo />
            <span>Continuer avec Google</span>
          </Button>

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            <span>{t("or")}</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {!otpFlowID ? (
            <form className="space-y-5" onSubmit={startOTP}>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium leading-none"
                  htmlFor="email"
                >
                  {t("emailLabel")}
                </label>

                <Input
                  id="email"
                  autoComplete="email"
                  onChange={(event) => setEmail(event.target.value)}
                  type="email"
                  value={email}
                />
              </div>

              <Button className="w-full" disabled={busy} type="submit">
                Continuer par email
              </Button>
            </form>
          ) : (
            <form className="space-y-5" onSubmit={verifyOTP}>
              <div className="space-y-2">
                <label
                  className="text-sm font-medium leading-none"
                  htmlFor="otp"
                >
                  {t("otpCodeLabel")}
                </label>

                <Input
                  id="otp"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  onChange={(event) => setOTPCode(event.target.value)}
                  placeholder="000000"
                  value={otpCode}
                />
              </div>

              <div className="space-y-3">
                <Button className="w-full" disabled={busy} type="submit">
                  {t("otpVerify")}
                </Button>

                <Button
                  className="w-full"
                  disabled={busy}
                  onClick={() => {
                    setOTPFlowID("");
                    setOTPCSRF("");
                    setOTPCode("");
                  }}
                  type="button"
                  variant="ghost"
                >
                  {t("changeEmail")}
                </Button>
              </div>
            </form>
          )}

          {result ? (
            <p className="whitespace-pre-wrap rounded-lg border bg-muted px-3 py-2 text-sm text-muted-foreground">
              {result}
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}
