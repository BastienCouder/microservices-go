export type GatewayResult<T> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; error: string; details?: unknown };

function parseErrorPayload(payload: unknown): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const value = (payload as { error?: unknown }).error;
    if (typeof value === "string" && value.trim() !== "") {
      return value;
    }
  }
  return "request failed";
}

async function parseJSON(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return null;
  }
  return (await response.json()) as unknown;
}

export async function gatewayJSON<T>(
  baseURL: string,
  path: string,
  init?: RequestInit & { organizationId?: string },
): Promise<GatewayResult<T>> {
  const url = `${baseURL.replace(/\/$/, "")}${path.startsWith("/") ? "" : "/"}${path}`;
  const organizationId = init?.organizationId?.trim() ?? "";

  const headers = new Headers(init?.headers ?? undefined);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (organizationId !== "") {
    headers.set("X-Organization-ID", organizationId);
  }

  const response = await fetch(url, {
    ...init,
    headers,
    credentials: "include",
  });

  const payload = await parseJSON(response);
  if (!response.ok) {
    return { ok: false, status: response.status, error: parseErrorPayload(payload), details: payload };
  }
  return { ok: true, status: response.status, data: payload as T };
}
