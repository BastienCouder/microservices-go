"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { LocaleSwitcher } from "@/app/[locale]/_components/locale-switcher";
import { buildBrowserCallbackURL, normalizeAppReturnTo } from "@/src/auth/routing";
import { getLocalizedPathname, type Locale } from "@/src/i18n/config";
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

function parseError(value: unknown, fallback: string): string {
  return value instanceof Error ? value.message : fallback;
}

async function parseJSON(response: Response): Promise<unknown> {
  return (await response.json()) as unknown;
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

  function getReturnTo(): string {
    if (typeof window === "undefined") {
      return normalizeAppReturnTo("", appURL);
    }

    const params = new URLSearchParams(window.location.search);
    const resolved = normalizeAppReturnTo(params.get("return_to"), appURL);
    window.sessionStorage.setItem("auth:return_to", resolved);
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

      setOTPMode(mode);
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

      const payload = (await parseJSON(response)) as {
        message?: string;
        error?: string;
      };

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
          returnTo: buildBrowserCallbackURL(window.location.origin, getReturnTo()),
        }),
      });

      const payload = (await parseJSON(response)) as {
        redirectTo?: string;
        error?: string;
      };

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
  <main className="relative grid min-h-svh place-items-center overflow-hidden bg-background p-6 text-foreground">
    <div className="pointer-events-none absolute inset-0 opacity-30">
      <AnimatedWave />
    </div>

    <section className="relative z-10 w-full max-w-md rounded-3xl border bg-background/90 p-8 shadow-sm backdrop-blur-xl">
      <header className="mb-8 space-y-2">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              {t("secureAccess")}
            </p>

            <h1 className="text-3xl font-semibold tracking-tight">
              {t("loginTitle")}
            </h1>

            <p className="text-sm leading-6 text-muted-foreground">
              {t("loginSubtitle")}
            </p>
          </div>

          <LocaleSwitcher className="shrink-0" />
        </div>
      </header>

      <div className="space-y-6">
        <Button
          className="w-full"
          disabled={busy}
          onClick={loginGoogle}
          type="button"
          variant="outline"
        >
          {t("google")}
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
                placeholder="you@example.com"
                type="email"
                value={email}
              />
            </div>

            <Button className="w-full" disabled={busy} type="submit">
              {t("otpLogin")}
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