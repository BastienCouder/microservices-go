type WebBillingCycle = "monthly" | "annual";

function getWebAuthURL(): string {
  const value = (import.meta.env as unknown as { VITE_WEB_AUTH_URL?: string }).VITE_WEB_AUTH_URL;
  if (typeof value === "string" && value.trim() !== "") {
    return value.trim();
  }
  return "http://localhost:30000/login";
}

function getWebPricingURL(options?: {
  checkoutPlan?: string;
  billingCycle?: WebBillingCycle;
}): string {
  try {
    const url = new URL(getWebAuthURL());
    url.pathname = "/";
    url.search = "";
    const checkoutPlan = options?.checkoutPlan?.trim();
    if (checkoutPlan) {
      url.searchParams.set("checkout_plan", checkoutPlan);
      url.searchParams.set("billing_cycle", options?.billingCycle ?? "monthly");
    }
    url.hash = "pricing";
    return url.toString();
  } catch {
    const checkoutPlan = options?.checkoutPlan?.trim();
    if (!checkoutPlan) {
      return "http://localhost:30000/#pricing";
    }
    return `http://localhost:30000/?checkout_plan=${encodeURIComponent(
      checkoutPlan,
    )}&billing_cycle=${encodeURIComponent(options?.billingCycle ?? "monthly")}#pricing`;
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

export function redirectToWebPricing(options?: {
  checkoutPlan?: string;
  billingCycle?: WebBillingCycle;
}): void {
  if (typeof window === "undefined") {
    return;
  }

  window.location.replace(getWebPricingURL(options));
}
