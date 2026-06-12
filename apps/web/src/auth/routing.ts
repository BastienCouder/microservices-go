export const KRATOS_BROWSER_PROXY_PATH = "/auth/k-7b9c2d41f6a3";

export function normalizeAppReturnTo(raw: string | null | undefined, appURL: string): string {
  const fallback = appURL.trim() || "http://localhost:30004";
  const value = raw?.trim();
  if (!value) {
    return fallback;
  }

  try {
    const target = new URL(value);
    const allowed = new URL(fallback);
    if (target.origin !== allowed.origin) {
      return fallback;
    }
    return target.toString();
  } catch {
    return fallback;
  }
}

export function buildBrowserCallbackURL(origin: string, returnTo: string): string {
  return `${origin}/login/callback?return_to=${encodeURIComponent(returnTo)}`;
}
