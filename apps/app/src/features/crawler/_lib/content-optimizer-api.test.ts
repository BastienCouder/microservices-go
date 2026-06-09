import { afterEach, describe, expect, test } from "bun:test";

import {
  analyzeSelectedContentOptimizerRecords,
  getContentOptimizerCrawl,
  getLatestContentOptimizerCrawl,
  getProjectWebsiteURL,
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
  test("loads the project website URL used for the first crawl", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(200, {
        success: true,
        data: { id: "prj_1", websiteUrl: "https://example.com" },
      });
    }) as typeof fetch;

    const websiteURL = await getProjectWebsiteURL("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
    });

    expect(websiteURL).toBe("https://example.com");
    expect(calls[0]?.url).toBe("http://api.test/projects/prj_1");
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe(
      "42",
    );
  });

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
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe(
      "42",
    );
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
        includePatterns: [
          "https://example.com/",
          "https://example.com/pricing",
        ],
      },
    });
  });

  test("analyzes selected discovered records without starting a new crawl", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      calls.push({ url: String(input), init });
      return jsonResponse(200, {
        success: true,
        data: {
          id: "selected-analysis-1",
          status: "completed",
          total: 2,
          finished: 2,
          records: [
            { url: "https://example.com/", status: "completed" },
            { url: "https://example.com/pricing", status: "completed" },
          ],
        },
      });
    }) as typeof fetch;

    const result = await analyzeSelectedContentOptimizerRecords("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      records: [
        { url: "https://example.com/", status: "completed", markdown: "# Home" },
        {
          url: "https://example.com/pricing",
          status: "completed",
          markdown: "# Pricing",
        },
      ],
    });

    expect(result.id).toBe("selected-analysis-1");
    expect(calls[0]?.url).toBe(
      "http://api.test/analysis/projects/prj_1/content-optimizer/analyze",
    );
    expect(calls[0]?.init?.method).toBe("POST");
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
      records: [
        { url: "https://example.com/", status: "completed", markdown: "# Home" },
        {
          url: "https://example.com/pricing",
          status: "completed",
          markdown: "# Pricing",
        },
      ],
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
          records: [
            { url: "https://example.com", title: "Home", markdown: "# Home" },
          ],
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
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe(
      "42",
    );
  });

  test("can load discovered URLs without triggering analysis", async () => {
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
          records: [{ url: "https://example.com", title: "Home" }],
        },
      });
    }) as typeof fetch;

    await getContentOptimizerCrawl("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      jobId: "crawl-123",
      limit: 1000,
      analyze: false,
    });

    expect(calls[0]?.url).toBe(
      "http://api.test/analysis/projects/prj_1/content-optimizer/crawl/crawl-123?limit=1000&analyze=false",
    );
  });

  test("surfaces Cloudflare authentication failures with an actionable message", async () => {
    globalThis.fetch = (async () =>
      jsonResponse(502, {
        error:
          'cloudflare crawl authentication failed: {"errors":[{"code":10000,"message":"Authentication error"}]}',
      })) as typeof fetch;

    await expect(
      startContentOptimizerCrawl("http://api.test", {
        projectId: "prj_1",
        organizationId: "42",
        url: "https://example.com",
        limit: 25,
        depth: 2,
        render: false,
      }),
    ).rejects.toThrow("Authentification Cloudflare invalide");
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
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe(
      "42",
    );
  });

  test("resolves a public project slug before reading the latest crawl", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    globalThis.fetch = (async (input, init) => {
      const url = String(input);
      calls.push({ url, init });
      if (url.endsWith("/analysis/projects/acme/content-optimizer/crawl")) {
        return jsonResponse(404, { error: "not found" });
      }
      if (url.endsWith("/projects")) {
        return jsonResponse(200, {
          success: true,
          data: [{ id: "prj_1", name: "Acme" }],
        });
      }
      return jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          organizationId: 42,
          jobId: "crawl-123",
          result: {
            id: "crawl-123",
            status: "completed",
            total: 0,
            finished: 0,
            records: [],
          },
          createdAt: "2026-05-13T08:00:00Z",
          updatedAt: "2026-05-13T08:10:00Z",
        },
      });
    }) as typeof fetch;

    const snapshot = await getLatestContentOptimizerCrawl("http://api.test", {
      projectId: "acme",
      organizationId: "42",
    });

    expect(snapshot?.projectId).toBe("prj_1");
    expect(calls.map((call) => call.url)).toEqual([
      "http://api.test/analysis/projects/acme/content-optimizer/crawl",
      "http://api.test/projects",
      "http://api.test/analysis/projects/prj_1/content-optimizer/crawl",
    ]);
    expect(new Headers(calls[1]?.init?.headers).get("X-Organization-ID")).toBe(
      "42",
    );
  });
});
