import { afterEach, describe, expect, test } from "bun:test";

import { createOnboardingProject } from "./onboarding-api";

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockFetchSequence(responses: Response[]) {
  let index = 0;
  globalThis.fetch = (async () => {
    const response = responses[index];
    index += 1;
    if (!response) {
      throw new Error(`unexpected fetch call #${index}`);
    }
    return response;
  }) as typeof fetch;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("createOnboardingProject", () => {
  test("creates the project without patching models during onboarding", async () => {
    mockFetchSequence([
      jsonResponse(201, {
        success: true,
        data: {
          id: "prj-299",
          organizationId: 42,
          name: "Acme",
        },
      }),
      jsonResponse(200, {
        success: true,
        data: [{ id: "prj-299", name: "Acme" }],
      }),
    ]);

    const result = await createOnboardingProject("http://api.test", {
      organizationId: "42",
      organizationName: "",
      brandName: "Acme",
      websiteUrl: "https://acme.test",
      attributionSource: "",
      brandDescription: "",
      industry: "",
      competitors: [],
      prompts: [],
      modelIds: ["gpt-oss-120b-free"],
    });

    expect(result.projectId).toBe("prj-299");
    expect(result.projectSlug).toBe("acme");
    expect(result.organizationId).toBe("42");
    expect(result.warnings).toEqual([]);
  });
});
