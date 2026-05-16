import { afterEach, describe, expect, test } from "bun:test";

import {
  isValidScanURL,
  pollAgentReadyScan,
  startAgentReadyScan,
} from "./audit-api";

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

describe("agent ready audit api", () => {
  test("validates absolute http and https URLs only", () => {
    expect(isValidScanURL("https://example.com")).toBe(true);
    expect(isValidScanURL("http://example.com/path")).toBe(true);
    expect(isValidScanURL("example.com")).toBe(false);
    expect(isValidScanURL("ftp://example.com")).toBe(false);
  });

  test("starts a content-site scan through the gateway route", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(202, { scan_id: "scan-1", status: "queued" });
    }) as typeof fetch;

    const result = await startAgentReadyScan("http://api.test", {
      url: "https://example.com",
      mode: "content-site",
      checks: ["robots_txt", "sitemap"],
    });

    expect(result).toEqual({ scan_id: "scan-1", status: "queued" });
    expect(calls[0]?.url).toBe("http://api.test/api/scan");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      url: "https://example.com",
      mode: "content-site",
      checks: ["robots_txt", "sitemap"],
    });
  });

  test("polls until the scan is done", async () => {
    const responses = [
      jsonResponse(200, { scan_id: "scan-1", status: "running" }),
      jsonResponse(200, {
        scan_id: "scan-1",
        status: "done",
        url: "https://example.com",
        mode: "content-site",
        score: 100,
        level: "Ready",
        summary: { passed: 6, failed: 0, warning: 0, skipped: 0 },
        categories: [],
        checks: [],
      }),
    ];
    globalThis.fetch = (async () => responses.shift() ?? jsonResponse(500, {})) as typeof fetch;

    const result = await pollAgentReadyScan("http://api.test", "scan-1", {
      delayMs: 0,
      maxAttempts: 3,
    });

    expect(result.status).toBe("done");
    expect(result.score).toBe(100);
  });
});
