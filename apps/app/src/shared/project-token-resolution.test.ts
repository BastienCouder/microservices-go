import { afterEach, describe, expect, test } from "bun:test";

import { resolveProjectTokenToContext } from "./project-token-resolution";

const originalFetch = globalThis.fetch;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("resolveProjectTokenToContext", () => {
  test("resolves a project slug from the scoped organization response", async () => {
    globalThis.fetch = (async (_input, init) => {
      expect(new Headers(init?.headers).get("X-Organization-ID")).toBe("org-1");
      return jsonResponse(200, [
        { id: "prj-1", name: "Acme", organizationId: "org-1" },
        { id: "prj-2", name: "Nike", organizationId: "org-1" },
      ]);
    }) as typeof fetch;

    expect(
      await resolveProjectTokenToContext("http://api.test", {
        projectToken: "nike",
        organizationId: "org-1",
      }),
    ).toEqual({
      projectId: "prj-2",
      projectSlug: "nike",
      organizationId: "org-1",
    });
  });

  test("retries without organization scope when the stored context returns forbidden", async () => {
    const seenOrganizationHeaders: Array<string | null> = [];
    const responses = [
      jsonResponse(403, { error: "forbidden" }),
      jsonResponse(200, [
        { id: "prj-9", name: "Fury Defendu", organizationId: "org-9" },
      ]),
    ];

    globalThis.fetch = (async (_input, init) => {
      seenOrganizationHeaders.push(new Headers(init?.headers).get("X-Organization-ID"));
      return responses.shift() ?? jsonResponse(500, { error: "unexpected" });
    }) as typeof fetch;

    expect(
      await resolveProjectTokenToContext("http://api.test", {
        projectToken: "fury-defendu",
        organizationId: "org-stale",
      }),
    ).toEqual({
      projectId: "prj-9",
      projectSlug: "fury-defendu",
      organizationId: "org-9",
    });

    expect(seenOrganizationHeaders).toEqual(["org-stale", null]);
  });
});
