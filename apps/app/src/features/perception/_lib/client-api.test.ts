import { afterEach, describe, expect, test } from "bun:test";

import { SELECTED_ORG_KEY } from "@/shared/selection";
import {
  getPerceptionClientJSON,
  postPerceptionClientJSON,
} from "./client-api";

const originalFetch = globalThis.fetch;
const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function installMockWindow() {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => {
          values.set(key, value);
        },
        removeItem: (key: string) => {
          values.delete(key);
        },
      },
    },
    writable: true,
  });
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    return;
  }
  Reflect.deleteProperty(globalThis, "window");
});

describe("perception client api", () => {
  test("sends the selected organization scope with optimize action requests", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    installMockWindow();
    window.localStorage.setItem(SELECTED_ORG_KEY, "42");
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(200, { data: [] });
    }) as typeof fetch;

    await getPerceptionClientJSON("/analysis/projects/prj_1/optimize-actions");
    await postPerceptionClientJSON("/analysis/projects/prj_1/optimize-actions", {
      status: "processing",
    });

    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("42");
    expect(new Headers(calls[1]?.init?.headers).get("X-Organization-ID")).toBe("42");
    expect(new Headers(calls[1]?.init?.headers).get("Content-Type")).toBe(
      "application/json",
    );
  });

  test("prefers an explicit organization scope override for optimize action requests", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    installMockWindow();
    window.localStorage.setItem(SELECTED_ORG_KEY, "42");
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(200, { data: [] });
    }) as typeof fetch;

    await getPerceptionClientJSON("/analysis/projects/prj_1/optimize-actions", {
      organizationId: "84",
    });
    await postPerceptionClientJSON(
      "/analysis/projects/prj_1/optimize-actions",
      { status: "processing" },
      { organizationId: "84" },
    );

    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("84");
    expect(new Headers(calls[1]?.init?.headers).get("X-Organization-ID")).toBe("84");
  });
});
