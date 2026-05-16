import { afterEach, describe, expect, test } from "bun:test";

import {
  completeTrafficGA4OAuth,
  loadTrafficPageData,
  selectTrafficGA4OAuthProperty,
  saveTrafficGA4Integration,
  startTrafficGA4OAuth,
} from "./traffic-report-api";

const originalFetch = globalThis.fetch;
const originalConsoleInfo = console.info;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchSequence(responses: Response[]) {
  const calls: Array<{ url: string; init?: RequestInit }> = [];
  let index = 0;
  globalThis.fetch = (async (input, init) => {
    calls.push({ url: String(input), init });
    const response = responses[index];
    index += 1;
    if (!response) {
      throw new Error(`unexpected fetch call #${index}`);
    }
    return response;
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
  console.info = originalConsoleInfo;
});

describe("loadTrafficPageData", () => {
  test("resolves a project slug and calls the traffic endpoint only when GA4 is connected", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: [
          { id: "prj_1", name: "Site France" },
          { id: "prj_2", name: "Site Europe" },
        ],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "123456789",
            hasServiceAccount: true,
            isConnected: true,
          },
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          propertyId: "123456789",
          dateRange: { startDate: "2026-03-02", endDate: "2026-04-01" },
          summary: {
            totalGeoSessions: 12,
            totalSessions: 120,
            geoShareOfTotal: 10,
            topEngine: "ChatGPT",
          },
          bySource: [{ source: "chatgpt.com", engine: "ChatGPT", sessions: 12 }],
          topPages: [],
          timeseries: [],
        },
      }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "?project=site-france&period=30d", {
      now: new Date("2026-04-01T12:00:00.000Z"),
    });

    expect(result.projectId).toBe("prj_1");
    expect(result.projectName).toBe("Acme");
    expect(result.integration.ga4.isConnected).toBe(true);
    expect(result.report.summary.totalGeoSessions).toBe(12);
    expect(calls[0]?.url).toBe("http://api.test/projects");
    expect(calls.some((call) => call.url.includes("/projects/site-france"))).toBe(false);
    expect(calls[3]?.url.includes("/attribution/projects/prj_1/traffic")).toBe(true);
    expect(new Headers(calls[3]?.init?.headers).get("X-Organization-ID")).toBe("42");
  });

  test("scopes project resolution and GA4 integration loading to the selected organization", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: [{ id: "prj_1", name: "Site France", brandName: "Acme" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "",
            hasServiceAccount: false,
            isConnected: false,
          },
        },
      }),
    ]);

    const result = await loadTrafficPageData(
      "http://api.test",
      "?project=site-france&organizationId=42",
    );

    expect(result.projectId).toBe("prj_1");
    expect(result.organizationId).toBe("42");
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("42");
    expect(new Headers(calls[1]?.init?.headers).get("X-Organization-ID")).toBe("42");
    expect(new Headers(calls[2]?.init?.headers).get("X-Organization-ID")).toBe("42");
  });

  test("resolves project slugs from brand names without probing the slug as an id", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: [{ id: "prj_1", name: "Site France", brandName: "Adidas" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Adidas",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "",
            hasServiceAccount: false,
            isConnected: false,
          },
        },
      }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "?project=adidas");

    expect(result.projectId).toBe("prj_1");
    expect(calls.some((call) => call.url.includes("/projects/adidas"))).toBe(false);
    expect(calls[1]?.url.includes("/projects/prj_1")).toBe(true);
  });

  test("does not replace a stale route project token with another project", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: [{ id: "prj_1", name: "Site France", brandName: "Acme" }],
      }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "?project=jjjj");

    expect(result.projectId).toBe(null);
    expect(result.organizationId).toBe("");
    expect(calls.some((call) => call.url.includes("/projects/jjjj"))).toBe(false);
    expect(calls).toHaveLength(1);
  });

  test("keeps project integration available when the GA4 report is unavailable", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: [{ id: "prj_1", name: "Site France" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "123456789",
            hasOAuthToken: true,
            isConnected: true,
          },
        },
      }),
      jsonResponse(503, { error: "Google Analytics est momentanément indisponible." }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "?project=site-france");

    expect(result.projectId).toBe("prj_1");
    expect(result.integration.ga4.isConnected).toBe(true);
    expect(result.report.summary.totalGeoSessions).toBe(0);
    expect(result.reportError).toBe("Google Analytics est momentanément indisponible.");
    expect(calls).toHaveLength(4);
    expect(calls[3]?.url.includes("/attribution/projects/prj_1/traffic")).toBe(true);
  });

  test("sends traffic search and engine filters to the backend traffic endpoint", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "prj_1", name: "Site France" }] }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "123456789",
            hasOAuthToken: true,
            isConnected: true,
          },
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          propertyId: "123456789",
          dataSource: "ga4",
          summary: { totalGeoSessions: 0, totalSessions: 120 },
          bySource: [],
          topPages: [],
          timeseries: [],
        },
      }),
    ]);

    await loadTrafficPageData("http://api.test", "?project=site-france", {
      search: "pricing",
      engine: "ChatGPT",
      now: new Date("2026-04-01T12:00:00.000Z"),
    });

    const trafficURL = new URL(calls[3]?.url ?? "");
    expect(trafficURL.pathname).toBe("/attribution/projects/prj_1/traffic");
    expect(trafficURL.searchParams.get("search")).toBe("pricing");
    expect(trafficURL.searchParams.get("engine")).toBe("ChatGPT");
  });

  test("uses a reassuring report message for generic traffic dependency errors", async () => {
    mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: [{ id: "prj_1", name: "Site France" }],
      }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "123456789",
            hasOAuthToken: true,
            isConnected: true,
          },
        },
      }),
      jsonResponse(503, { error: "Service momentanément indisponible." }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "?project=site-france");

    expect(result.projectId).toBe("prj_1");
    expect(result.reportError).toBe(
      "Connexion GA4 enregistrée. Le rapport est momentanément indisponible. Réessaie avec Actualiser.",
    );
  });

  test("does not call the traffic endpoint before GA4 is connected", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "prj_1", name: "Site France" }] }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "",
            hasServiceAccount: false,
            isConnected: false,
          },
        },
      }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "");

    expect(result.projectId).toBe("prj_1");
    expect(result.integration.ga4.isConnected).toBe(false);
    expect(result.report.summary.totalGeoSessions).toBe(0);
    expect(calls).toHaveLength(3);
  });

  test("does not expose a report error when the traffic endpoint reports GA4 is not configured", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "prj_1", name: "Site France" }] }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "123456789",
            hasOAuthToken: true,
            isConnected: true,
          },
        },
      }),
      jsonResponse(400, {
        error: "validation error: ga4 integration is not configured for project",
      }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "?project=site-france");

    expect(result.projectId).toBe("prj_1");
    expect(result.integration.ga4.isConnected).toBe(false);
    expect(result.report.summary.totalGeoSessions).toBe(0);
    expect(result.reportError).toBe(null);
    expect(calls).toHaveLength(4);
  });

  test("does not expose fake traffic reports in the frontend", async () => {
    const consoleCalls: unknown[][] = [];
    console.info = (...args: unknown[]) => {
      consoleCalls.push(args);
    };
    mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "prj_1", name: "Site France" }] }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "123456789",
            hasOAuthToken: true,
            isConnected: true,
          },
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          propertyId: "123456789",
          dataSource: "fake",
          dateRange: { startDate: "2026-03-29", endDate: "2026-04-28" },
          generatedAt: "2026-04-28T12:00:00Z",
          summary: {
            totalGeoSessions: 183,
            totalSessions: 1464,
            geoShareOfTotal: 12.5,
            topEngine: "ChatGPT",
          },
          bySource: [
            { source: "chatgpt.com", engine: "ChatGPT", sessions: 86 },
            { source: "perplexity.ai", engine: "Perplexity", sessions: 42 },
            { source: "gemini.google.com", engine: "Gemini", sessions: 25 },
            { source: "claude.ai", engine: "Claude", sessions: 18 },
            { source: "copilot.microsoft.com", engine: "Microsoft Copilot", sessions: 12 },
          ],
          topPages: [
            { path: "/", title: "Home", source: "chatgpt.com", sessions: 38 },
          ],
          timeseries: [
            { date: "2026-04-28", sessions: 12, engagedSessions: 9 },
          ],
        },
      }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "?project=site-france");

    expect(consoleCalls).toHaveLength(0);
    expect(result.report.dataSource).toBe("");
    expect(result.report.summary.totalGeoSessions).toBe(0);
    expect(result.report.bySource).toHaveLength(0);
    expect(result.report.topPages).toHaveLength(0);
    expect(result.report.timeseries).toHaveLength(0);
    expect(result.reportError).toBe("Aucune donnée GA4 réelle disponible pour cette période.");
  });

  test("does not log real GA4 data even when values look like fallback rows", async () => {
    const consoleCalls: unknown[][] = [];
    console.info = (...args: unknown[]) => {
      consoleCalls.push(args);
    };
    mockFetchSequence([
      jsonResponse(200, { success: true, data: [{ id: "prj_1", name: "Site France" }] }),
      jsonResponse(200, {
        success: true,
        data: {
          id: "prj_1",
          organizationId: 42,
          brandName: "Acme",
          name: "Site France",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "123456789",
            hasOAuthToken: true,
            isConnected: true,
          },
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          propertyId: "123456789",
          dataSource: "ga4",
          summary: {
            totalGeoSessions: 183,
            totalSessions: 1464,
            topEngine: "ChatGPT",
          },
          bySource: [
            { source: "chatgpt.com", engine: "ChatGPT", sessions: 86 },
            { source: "perplexity.ai", engine: "Perplexity", sessions: 42 },
            { source: "gemini.google.com", engine: "Gemini", sessions: 25 },
            { source: "claude.ai", engine: "Claude", sessions: 18 },
            { source: "copilot.microsoft.com", engine: "Microsoft Copilot", sessions: 12 },
          ],
          topPages: [{ path: "/", title: "Home", source: "chatgpt.com", sessions: 38 }],
          timeseries: [{ date: "2026-04-28", sessions: 12 }],
        },
      }),
    ]);

    const result = await loadTrafficPageData("http://api.test", "?project=site-france");

    expect(result.report.dataSource).toBe("ga4");
    expect(consoleCalls).toHaveLength(0);
  });
});

describe("saveTrafficGA4Integration", () => {
  test("patches the project GA4 integration with organization scope", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: {
          projectId: "prj_1",
          ga4: {
            propertyId: "123456789",
            hasServiceAccount: true,
            isConnected: true,
          },
        },
      }),
    ]);

    const result = await saveTrafficGA4Integration("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      propertyId: "123456789",
      serviceAccountJSON: "{\"client_email\":\"geo@example.com\"}",
    });

    expect(result.ga4.isConnected).toBe(true);
    expect(calls[0]?.url.includes("/projects/prj_1/impact-integrations")).toBe(true);
    expect(calls[0]?.init?.method).toBe("PATCH");
    expect(new Headers(calls[0]?.init?.headers).get("X-Organization-ID")).toBe("42");
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({
        ga4: {
          propertyId: "123456789",
          serviceAccountJSON: "{\"client_email\":\"geo@example.com\"}",
        },
      }),
    );
  });
});

describe("Traffic GA4 OAuth", () => {
  test("starts OAuth and selects a GA4 property with organization scope", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: {
          authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth?state=abc",
          state: "abc",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: {
          integration: {
            projectId: "prj_1",
            ga4: {
              propertyId: "123456789",
              authMode: "oauth",
              hasOAuthToken: true,
              isConnected: true,
            },
          },
          llmSetup: {
            setupStatus: "success",
            createdResources: {
              channelGroupName: "properties/123/channelGroups/456",
              customDimensionName: "properties/123/customDimensions/789",
            },
          },
        },
      }),
    ]);

    const start = await startTrafficGA4OAuth("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      redirectUri: "http://localhost:30006/traffic?project=site-france",
    });
    const selected = await selectTrafficGA4OAuthProperty("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      propertyId: "123456789",
    });

    expect(start.authorizationUrl.includes("accounts.google.com")).toBe(true);
    expect(selected.integration.ga4.authMode).toBe("oauth");
    expect(selected.integration.ga4.isConnected).toBe(true);
    expect(selected.llmSetup?.setupStatus).toBe("success");
    expect(selected.llmSetup?.createdResources.customDimensionName).toBe(
      "properties/123/customDimensions/789",
    );
    expect(calls[0]?.url.includes("/projects/prj_1/impact-integrations/ga4/oauth/start")).toBe(true);
    expect(calls[1]?.url.includes("/projects/prj_1/impact-integrations/ga4/oauth/property")).toBe(true);
    expect(new Headers(calls[1]?.init?.headers).get("X-Organization-ID")).toBe("42");
  });

  test("completes OAuth and can return selectable properties without a provided property id", async () => {
    const calls = mockFetchSequence([
      jsonResponse(200, {
        success: true,
        data: {
          integration: {
            projectId: "prj_1",
            ga4: {
              propertyId: "",
              authMode: "oauth",
              hasOAuthToken: true,
              isConnected: false,
            },
          },
          properties: [
            {
              propertyId: "123456789",
              displayName: "Site France",
              accountName: "Acme",
            },
          ],
          llmSetup: {
            setupStatus: "partial_success",
            createdResources: {
              channelGroupName: "properties/123/channelGroups/456",
            },
            errors: [
              {
                resource: "customDimension",
                message: "already archived",
              },
            ],
          },
        },
      }),
    ]);

    const completed = await completeTrafficGA4OAuth("http://api.test", {
      projectId: "prj_1",
      organizationId: "42",
      code: "auth-code",
      state: "state",
      redirectUri: "http://localhost:30004/traffic",
    });

    expect(completed.integration.ga4.propertyId).toBe("");
    expect(completed.integration.ga4.hasOAuthToken).toBe(true);
    expect(completed.properties[0]?.propertyId).toBe("123456789");
    expect(completed.llmSetup?.setupStatus).toBe("partial_success");
    expect(completed.llmSetup?.errors[0]?.resource).toBe("customDimension");
    expect(calls[0]?.init?.body).toBe(
      JSON.stringify({
        code: "auth-code",
        state: "state",
        redirectUri: "http://localhost:30004/traffic",
        propertyId: "",
      }),
    );
  });
});
