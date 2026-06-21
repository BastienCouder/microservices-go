function getWebAuthURL(): string {
  const value = (import.meta.env as unknown as { VITE_WEB_AUTH_URL?: string }).VITE_WEB_AUTH_URL;
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return "http://localhost:30000/login";
}

function getWebPricingURL(): string {
  try {
    const url = new URL(getWebAuthURL());
    url.pathname = "/";
    url.search = "";
    url.hash = "pricing";
    return url.toString();
  } catch {
    return "http://localhost:30000/#pricing";
  }
}

export function navigateToWebAuth(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.replace(getWebAuthURL());
}

export function redirectToWebAuth(returnTo?: string): void {
  if (typeof window === "undefined") {
    return;
  }

  const target = getWebAuthURL();
  const nextReturnTo = returnTo?.trim() || window.location.href;
  const separator = target.includes("?") ? "&" : "?";
  const destination = `${target}${separator}return_to=${encodeURIComponent(nextReturnTo)}`;
  window.location.replace(destination);
}

export function redirectToWebPricing(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.replace(getWebPricingURL());
}
