import { afterEach, describe, expect, test } from "bun:test";

import { gatewayJSON } from "./gateway";

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("gatewayJSON", () => {
  test("retries transient gateway dependency failures on GET requests", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url) => {
      calls.push(String(url));
      if (calls.length === 1) {
        return jsonResponse(503, { error: "auth dependency unavailable" });
      }
      return jsonResponse(200, { loaded: true });
    }) as typeof fetch;

    const response = await gatewayJSON<{ loaded: boolean }>(
      "http://api.test",
      "/projects/nike/models",
      { method: "GET", retry: { delayMs: 0 } },
    );

    expect(response).toEqual({
      ok: true,
      status: 200,
      data: { loaded: true },
    });
    expect(calls).toEqual([
      "http://api.test/projects/nike/models",
      "http://api.test/projects/nike/models",
    ]);
  });

  test("does not retry non-idempotent requests by default", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return jsonResponse(503, { error: "auth dependency unavailable" });
    }) as typeof fetch;

    const response = await gatewayJSON<{ loaded: boolean }>(
      "http://api.test",
      "/projects",
      { method: "POST", body: JSON.stringify({ name: "Acme" }), retry: { delayMs: 0 } },
    );

    expect(response).toEqual({
      ok: false,
      status: 503,
      error: "auth dependency unavailable",
      details: { error: "auth dependency unavailable" },
    });
    expect(calls).toBe(1);
  });
});
