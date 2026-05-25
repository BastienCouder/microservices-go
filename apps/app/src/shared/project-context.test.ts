import { describe, expect, test } from "bun:test";

import {
  applyResolvedProjectContextSearch,
  findResolvedProjectContext,
  normalizeProjectContextHierarchy,
} from "./project-context";

describe("project context resolution", () => {
  test("finds a project organization from hierarchy payloads", () => {
    const nikeHierarchy = normalizeProjectContextHierarchy(
      {
        organization: { id: "org-nike", name: "Nike" },
        projects: [{ id: "prj-nike", name: "Nike" }],
      },
      { id: "org-nike", name: "Nike", slug: "nike" },
    );
    const bcoHierarchy = normalizeProjectContextHierarchy(
      {
        organization: { id: "org-bco", name: "BCO Org" },
        projects: [{ id: "prj-bco", name: "BCO" }],
      },
      { id: "org-bco", name: "BCO Org", slug: "bco-org" },
    );

    const context = findResolvedProjectContext(
      [nikeHierarchy, bcoHierarchy].filter((value): value is NonNullable<typeof value> => value !== null),
      "bco",
    );

    expect(context?.organizationId).toBe("org-bco");
    expect(context?.projectId).toBe("prj-bco");
    expect(context?.projectSlug).toBe("bco");
    expect(context).toEqual({
      organizationId: "org-bco",
      organizationSlug: "bco-org",
      projectId: "prj-bco",
      projectSlug: "bco",
      projectName: "BCO",
    });
  });

  test("overwrites stale organization scope with the resolved project organization", () => {
    expect(
      applyResolvedProjectContextSearch("?project=bco&organizationId=org-nike&period=7d", {
        organizationId: "org-bco",
        organizationSlug: "bco-org",
        projectId: "prj-bco",
        projectSlug: "bco",
        projectName: "BCO",
      }),
    ).toBe("?project=bco&organizationId=org-bco&period=7d");
  });
});
