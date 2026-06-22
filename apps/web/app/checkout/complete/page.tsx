import { CheckoutCompleteClient } from "./checkout-complete-client";

export const dynamic = "force-dynamic";

function readRuntimeURL(value: string | undefined, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }

  const trimmed = value.trim();
  return trimmed !== "" ? trimmed : fallback;
}

export default function CheckoutCompletePage() {
  return (
    <CheckoutCompleteClient
      appURL={readRuntimeURL(process.env.NEXT_PUBLIC_APP_URL, "http://localhost:30004")}
      gatewayURL={readRuntimeURL(process.env.NEXT_PUBLIC_API_GATEWAY_URL, "http://localhost:50000")}
      localePrefix=""
    />
  );
}
