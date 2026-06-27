"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  clearAuthReturnTo,
  clearCheckoutIntent,
} from "@/src/auth/browser-intent";
import { confirmStripeCheckoutOnWeb } from "@/src/billing/checkout-confirmation";

type CheckoutCompleteClientProps = {
  appURL: string;
  gatewayURL: string;
  localePrefix: string;
};

const CHECKOUT_CONFIRMATION_KEY = "checkout:confirmation";

function buildAppSuccessURL(appURL: string, organizationId: string): string {
  const url = new URL("/onboarding", appURL);
  url.searchParams.set("setup", "account");
  url.searchParams.set("checkout", "success");
  if (organizationId.trim() !== "") {
    url.searchParams.set("organizationId", organizationId.trim());
  }
  return url.toString();
}

export function CheckoutCompleteClient({
  appURL,
  gatewayURL,
}: CheckoutCompleteClientProps) {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState(() => {
    const sessionId = searchParams.get("session_id")?.trim() ?? "";
    const organizationId = searchParams.get("organization_id")?.trim() ?? "";
    if (sessionId && organizationId) {
      return { sessionId, organizationId };
    }
    if (typeof window === "undefined") {
      return { sessionId: "", organizationId: "" };
    }
    try {
      const raw = window.sessionStorage.getItem(CHECKOUT_CONFIRMATION_KEY);
      if (!raw) {
        return { sessionId: "", organizationId: "" };
      }
      const parsed = JSON.parse(raw) as {
        sessionId?: string;
        organizationId?: string;
      };
      return {
        sessionId: parsed.sessionId?.trim() ?? "",
        organizationId: parsed.organizationId?.trim() ?? "",
      };
    } catch {
      return { sessionId: "", organizationId: "" };
    }
  });
  const successURL = useMemo(
    () => buildAppSuccessURL(appURL, confirmation.organizationId),
    [appURL, confirmation.organizationId],
  );

  useEffect(() => {
    if (confirmation.sessionId && confirmation.organizationId) {
      window.sessionStorage.setItem(
        CHECKOUT_CONFIRMATION_KEY,
        JSON.stringify(confirmation),
      );
    }
    const cleanedURL = new URL(window.location.href);
    cleanedURL.searchParams.delete("session_id");
    cleanedURL.searchParams.delete("organization_id");
    window.history.replaceState({}, "", cleanedURL.toString());
  }, [confirmation]);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      if (!confirmation.sessionId || !confirmation.organizationId) {
        setError("Paramètres de confirmation manquants.");
        return;
      }

      try {
        await confirmStripeCheckoutOnWeb({
          gatewayURL,
          organizationId: confirmation.organizationId,
          sessionId: confirmation.sessionId,
        });
        if (cancelled) {
          return;
        }
        clearAuthReturnTo();
        clearCheckoutIntent();
        window.sessionStorage.removeItem(CHECKOUT_CONFIRMATION_KEY);
        window.location.replace(successURL);
      } catch (value) {
        if (cancelled) {
          return;
        }
        setError(value instanceof Error ? value.message : "Confirmation impossible.");
      }
    }

    void run();

    return () => {
      cancelled = true;
    };
  }, [confirmation, gatewayURL, successURL]);

  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <div className="w-full max-w-md rounded-xl border bg-background px-6 py-8 text-center">
        <p className="text-sm text-muted-foreground">
          {error ? error : "Confirmation de votre abonnement..."}
        </p>
        {error ? (
          <div className="mt-5 flex flex-col gap-3">
            <button
              className="rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground"
              onClick={() => {
                setError("");
                setConfirmation((current) => ({ ...current }));
              }}
              type="button"
            >
              Réessayer
            </button>
          </div>
        ) : null}
      </div>
    </main>
  );
}
