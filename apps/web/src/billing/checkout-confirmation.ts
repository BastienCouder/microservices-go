"use client";

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function readErrorMessage(payload: unknown): string {
  if (isRecord(payload) && isRecord(payload.error)) {
    const message = payload.error.message;
    if (typeof message === "string" && message.trim() !== "") {
      return message.trim();
    }
  }
  if (isRecord(payload)) {
    const message = payload.error;
    if (typeof message === "string" && message.trim() !== "") {
      return message.trim();
    }
  }
  return "request failed";
}

async function parseJSON(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }

  return response.json() as Promise<unknown>;
}

export async function confirmStripeCheckoutOnWeb(input: {
  gatewayURL: string;
  organizationId: string;
  sessionId: string;
}): Promise<void> {
  const organizationId = input.organizationId.trim();
  const sessionId = input.sessionId.trim();
  if (!organizationId || !sessionId) {
    throw new Error("missing checkout confirmation parameters");
  }

  const headers = new Headers({
    "Accept": "application/json",
    "Content-Type": "application/json",
    "X-Organization-ID": organizationId,
  });

  const response = await fetch(
    `${input.gatewayURL.replace(/\/$/, "")}/billing/stripe/checkout-session/confirm`,
    {
      method: "POST",
      headers,
      credentials: "include",
      cache: "no-store",
      body: JSON.stringify({
        organization_id: Number.parseInt(organizationId, 10),
        session_id: sessionId,
      }),
    },
  );

  const payload = await parseJSON(response);
  if (!response.ok) {
    throw new Error(readErrorMessage(payload));
  }
}
