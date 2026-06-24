"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  clearAuthReturnTo,
  clearCheckoutIntent,
  readAuthReturnTo,
} from "@/src/auth/browser-intent";
import { normalizeAppReturnTo } from "@/src/auth/routing";
import { AnimatedWave } from "@/app/[locale]/_components/animated-wave";

type AuthCallbackClientProps = {
  appURL: string;
  webURL: string;
};

export function AuthCallbackClient({
  appURL,
  webURL,
}: AuthCallbackClientProps) {
  const searchParams = useSearchParams();

  useEffect(() => {
    const callbackError =
      searchParams.get("error_description") ||
      searchParams.get("error") ||
      searchParams.get("reason");
    const errorId = searchParams.get("id");

    if (callbackError || errorId) {
      const currentPath = window.location.pathname;
      const firstSegment = currentPath.split("/").filter(Boolean)[0];
      const localePrefix = firstSegment === "en" ? "/en" : "";
      const errorURL = new URL(`${localePrefix}/login/error`, window.location.origin);

      if (callbackError) {
        errorURL.searchParams.set("error", callbackError);
      }
      if (errorId) {
        errorURL.searchParams.set("id", errorId);
      }

      window.location.replace(errorURL.toString());
      return;
    }

    const storedReturnTo = readAuthReturnTo();
    const fallbackReturnTo = normalizeAppReturnTo(
      searchParams.get("return_to"),
      appURL,
      { allowedURLs: [webURL] },
    );
    const targetURL = storedReturnTo || fallbackReturnTo;
    clearAuthReturnTo();
    let sameWebOrigin = false;
    try {
      sameWebOrigin = new URL(targetURL).origin === new URL(webURL).origin;
    } catch {
      sameWebOrigin = false;
    }
    if (!sameWebOrigin) {
      clearCheckoutIntent();
    }
    window.location.replace(targetURL);
  }, [appURL, searchParams, webURL]);

  return (
    <main className="relative grid h-[calc(100vh-5rem)] place-items-center overflow-hidden bg-background p-6 text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-30">
        <AnimatedWave />
      </div>

      <section className="relative z-10 w-full max-w-md rounded-xl border bg-background/90 p-8">
        <header className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">
            Connexion
          </h1>

          <p className="text-sm leading-6 text-muted-foreground">
            Redirection en cours...
          </p>
        </header>
      </section>
    </main>
  );
}
