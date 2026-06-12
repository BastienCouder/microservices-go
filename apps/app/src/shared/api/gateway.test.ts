import { afterEach, describe, expect, test } from "bun:test";

import { gatewayJSON, toGatewayError, unwrapGatewayPayload } from "./gateway";
import {
  SELECTED_ORG_KEY,
  storeSelectedOrganizationContext,
} from "@/shared/selection";

const originalFetch = globalThis.fetch;

function getTestStorage(): Storage | undefined {
  if (typeof window !== "undefined") {
    return window.localStorage;
  }
  if ("localStorage" in globalThis) {
    return globalThis.localStorage;
  }
  return undefined;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  getTestStorage()?.removeItem(SELECTED_ORG_KEY);
  getTestStorage()?.removeItem("selected-organization-internal-id");
});

describe("gatewayJSON", () => {
  test("sends JSON accept headers on gateway requests", async () => {
    let acceptHeader = "";
    globalThis.fetch = (async (_url, init) => {
      acceptHeader = new Headers(init?.headers).get("Accept") ?? "";
      return jsonResponse(200, { success: true, data: { loaded: true } });
    }) as typeof fetch;

    await gatewayJSON<{ loaded: boolean }>("http://api.test", "/projects", {
      method: "GET",
    });

    expect(acceptHeader).toBe("application/json");
  });

  test("sends the provided organization id verbatim in gateway headers", async () => {
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;
    let organizationHeader = "";
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
        dispatchEvent: () => true,
      },
    });
    storeSelectedOrganizationContext({
      organizationId: "2",
      publicId: "org_a1b2c3d4",
    });
    globalThis.fetch = (async (_url, init) => {
      organizationHeader = new Headers(init?.headers).get("X-Organization-ID") ?? "";
      return jsonResponse(200, { success: true, data: { loaded: true } });
    }) as typeof fetch;

    await gatewayJSON<{ loaded: boolean }>("http://api.test", "/projects", {
      method: "GET",
      organizationId: "2",
    });

    expect(organizationHeader).toBe("2");
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("returns a timeout result when the gateway request hangs", async () => {
    globalThis.fetch = (async (_url, init) => {
      await new Promise((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(init.signal?.reason),
          { once: true },
        );
      });
      return jsonResponse(200, { success: true, data: { loaded: true } });
    }) as typeof fetch;

    const response = await gatewayJSON<{ loaded: boolean }>(
      "http://api.test",
      "/projects",
      { method: "GET", timeoutMs: 1, retry: { attempts: 0 } },
    );

    expect(response).toEqual({
      ok: false,
      status: 0,
      error: "The request timed out. Please try again.",
      details: null,
      rawError: "request timed out",
      kind: "timeout",
    });
  });

  test("returns a gateway error when an error response contains invalid json", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>bad gateway</html>", {
        status: 502,
        headers: { "Content-Type": "application/json" },
      })) as typeof fetch;

    const response = await gatewayJSON<{ loaded: boolean }>(
      "http://api.test",
      "/projects",
      { method: "GET", retry: { attempts: 0 } },
    );

    expect(response).toEqual({
      ok: false,
      status: 502,
      error: "The service is temporarily unavailable.",
      rawError: "request failed",
      kind: "dependency_unavailable",
      details: null,
    });
  });

  test("retries transient gateway dependency failures on GET requests", async () => {
    const calls: string[] = [];
    globalThis.fetch = (async (url) => {
      calls.push(String(url));
      if (calls.length === 1) {
        return jsonResponse(503, { error: "auth dependency unavailable" });
      }
      return jsonResponse(200, { success: true, data: { loaded: true } });
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
      error: "The service is temporarily unavailable.",
      rawError: "auth dependency unavailable",
      kind: "dependency_unavailable",
      details: { error: "auth dependency unavailable" },
    });
    expect(calls).toBe(1);
  });

  test("normalizes structured API error payloads", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(400, {
        error: {
          code: "invalid_request",
          message: "invalid subscription: seats must be positive",
        },
      })) as typeof fetch;

    const result = await gatewayJSON<unknown>(
      "https://api.test",
      "/billing/subscriptions",
      {
        method: "POST",
        retry: { attempts: 0 },
      },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(400);
      expect(result.code).toBe("invalid_request");
      expect(result.kind).toBe("validation");
      expect(result.rawError).toBe("invalid subscription: seats must be positive");
      expect(result.error).toBe("Check the information you entered.");

      const error = toGatewayError(result, "fallback");
      expect(error.name).toBe("GatewayError");
      expect(error.status).toBe(400);
      expect(error.code).toBe("invalid_request");
      expect(error.kind).toBe("validation");
      expect(error.message).toBe("Check the information you entered.");
    }
  });

  test("preserves rate limit error codes", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(429, {
        error: {
          code: "rate_limited",
          message: "rate limit exceeded",
        },
      })) as typeof fetch;

    const result = await gatewayJSON<unknown>("https://api.test", "/projects", {
      method: "GET",
      retry: { attempts: 0 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.code).toBe("rate_limited");
      expect(result.kind).toBe("rate_limited");
      expect(result.rawError).toBe("rate limit exceeded");
      expect(result.error).toBe("Too many requests. Please try again in a moment.");
    }
  });

  test("classifies quota exceeded before generic 429 rate limits", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(429, {
        error: {
          code: "quota_exceeded",
          message: "quota exceeded",
        },
      })) as typeof fetch;

    const result = await gatewayJSON<unknown>("https://api.test", "/projects", {
      method: "POST",
      retry: { attempts: 0 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(429);
      expect(result.code).toBe("quota_exceeded");
      expect(result.kind).toBe("quota_exceeded");
      expect(result.rawError).toBe("quota exceeded");
      expect(result.error).toBe("You do not have any credits left.");
    }
  });

  test("unwraps enveloped success payloads", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(200, {
        success: true,
        data: { id: "prj_1", name: "Acme" },
      })) as typeof fetch;

    const result = await gatewayJSON<{ id: string; name: string }>(
      "https://api.test",
      "/projects/prj_1",
      { method: "GET", retry: { attempts: 0 } },
    );

    expect(result).toEqual({
      ok: true,
      status: 200,
      data: { id: "prj_1", name: "Acme" },
    });
  });

  test("keeps legacy string error payloads compatible", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(409, { error: "legacy failure" })) as typeof fetch;

    const result = await gatewayJSON<unknown>("https://api.test", "/organizations/1", {
      method: "GET",
      retry: { attempts: 0 },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.code).toBe(undefined);
      expect(result.kind).toBe("conflict");
      expect(result.rawError).toBe("legacy failure");
      expect(result.error).toBe("This action conflicts with the current state.");
    }
  });
});

describe("unwrapGatewayPayload", () => {
  test("unwraps success envelopes even when metadata is present", () => {
    expect(
      unwrapGatewayPayload({
        data: [{ id: "gpt-oss-20b-free" }],
        success: true,
      }),
    ).toEqual([{ id: "gpt-oss-20b-free" }]);
  });
});
