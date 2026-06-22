"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  clearAuthReturnTo,
  clearCheckoutIntent,
  readAuthReturnTo,
} from "@/src/auth/browser-intent";
import { normalizeAppReturnTo } from "@/src/auth/routing";

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
    <main className="grid min-h-screen place-items-center bg-background px-6 text-center text-sm text-muted-foreground">
      Redirection...
    </main>
  );
}
