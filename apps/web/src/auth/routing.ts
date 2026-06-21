export const KRATOS_BROWSER_PROXY_PATH = "/auth/k-7b9c2d41f6a3";

type NormalizeReturnToOptions = {
  allowedURLs?: string[];
};

function readOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return "";
  }
}

export function normalizeAppReturnTo(
  raw: string | null | undefined,
  fallbackURL: string,
  options: NormalizeReturnToOptions = {},
): string {
  const fallback = fallbackURL.trim() || "http://localhost:30004";
  const value = raw?.trim();
  if (!value) {
    return fallback;
  }

  try {
    const target = new URL(value);
    const allowedOrigins = new Set(
      [fallback, ...(options.allowedURLs ?? [])]
        .map(readOrigin)
        .filter(Boolean),
    );
    if (!allowedOrigins.has(target.origin)) {
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
