import { afterEach, describe, expect, test } from "bun:test";

import {
  getContentOptimizerCrawl,
  getLatestContentOptimizerCrawl,
  startContentOptimizerCrawl,
} from "./content-optimizer-api";

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

describe("content optimizer api", () => {
  test("starts a Cloudflare crawl through the analysis gateway route", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(201, {
        success: true,
        data: { id: "crawl-123", status: "running" },
      });
    }) as typeof fetch;

    const job = await startContentOptimizerCrawl("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      url: "https://example.com",
      limit: 25,
      depth: 2,
      render: false,
    });

    expect(job.id).toBe("crawl-123");
    expect(calls[0]?.url).toBe(
      "http://api.test/analysis/projects/prj_1/content-optimizer/crawl",
    );
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("42");
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      url: "https://example.com",
      limit: 25,
      depth: 2,
      render: false,
      source: "all",
      formats: ["markdown"],
      crawlPurposes: ["search", "ai-input"],
    });
  });

  test("starts a crawl constrained to selected page URLs", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(201, {
        success: true,
        data: { id: "crawl-selected", status: "running" },
      });
    }) as typeof fetch;

    await startContentOptimizerCrawl("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      url: "https://example.com",
      limit: 2,
      depth: 1,
      render: false,
      includePatterns: [
        "https://example.com/",
        " https://example.com/pricing ",
        "https://example.com/",
      ],
    });

    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      url: "https://example.com",
      limit: 2,
      depth: 1,
      render: false,
      source: "all",
      formats: ["markdown"],
      crawlPurposes: ["search", "ai-input"],
      options: {
        includePatterns: ["https://example.com/", "https://example.com/pricing"],
      },
    });
  });

  test("loads completed crawl records with a lightweight status filter", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(200, {
        success: true,
        data: {
          id: "crawl-123",
          status: "completed",
          total: 1,
          finished: 1,
          records: [{ url: "https://example.com", title: "Home", markdown: "# Home" }],
        },
      });
    }) as typeof fetch;

    const result = await getContentOptimizerCrawl("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      jobId: "crawl-123",
      status: "completed",
      limit: 100,
    });

    expect(result.status).toBe("completed");
    expect(calls[0]?.url).toBe(
      "http://api.test/analysis/projects/prj_1/content-optimizer/crawl/crawl-123?limit=100&status=completed",
    );
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("42");
  });

  test("loads latest saved crawl result for a project", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          organizationId: 42,
          jobId: "crawl-123",
          result: {
            id: "crawl-123",
            status: "completed",
            total: 1,
            finished: 1,
            records: [{ url: "https://example.com", title: "Home" }],
          },
          createdAt: "2026-05-13T08:00:00Z",
          updatedAt: "2026-05-13T08:10:00Z",
        },
      });
    }) as typeof fetch;

    const snapshot = await getLatestContentOptimizerCrawl("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
    });

    expect(snapshot?.jobId).toBe("crawl-123");
    expect(calls[0]?.url).toBe(
      "http://api.test/analysis/projects/prj_1/content-optimizer/crawl",
    );
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("42");
  });
});
