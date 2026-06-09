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
      "prj-bco",
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

  test("overwrites stale organization scope and injects the canonical project id", () => {
    const search = applyResolvedProjectContextSearch("?project=bco&organizationId=org-nike&period=7d", {
        organizationId: "org-bco",
        organizationSlug: "bco-org",
        projectId: "prj-bco",
        projectSlug: "bco",
        projectName: "BCO",
      });

    const params = new URLSearchParams(search.slice(1));
    expect(params.get("project")).toBe("bco");
    expect(params.get("projectId")).toBe("prj-bco");
    expect(params.get("organizationId")).toBe("org-bco");
    expect(params.get("period")).toBe("7d");
  });

  test("resolves only by canonical project id even when duplicate project slugs exist", () => {
    const firstHierarchy = normalizeProjectContextHierarchy(
      {
        organization: { id: "1", name: "Org One" },
        projects: [{ id: "prj-1", name: "Adidas" }],
      },
      { id: "1", name: "Org One", slug: "org-one" },
    );
    const secondHierarchy = normalizeProjectContextHierarchy(
      {
        organization: { id: "2", name: "Org Two" },
        projects: [{ id: "prj-2", name: "Adidas" }],
      },
      { id: "2", name: "Org Two", slug: "org-two" },
    );

    const context = findResolvedProjectContext(
      [firstHierarchy, secondHierarchy].filter(
        (value): value is NonNullable<typeof value> => value !== null,
      ),
      "prj-2",
      "2",
    );

    expect(context?.organizationId).toBe("2");
    expect(context?.projectId).toBe("prj-2");
  });

  test("does not resolve a project token against another organization when the hinted organization misses it", () => {
    const firstHierarchy = normalizeProjectContextHierarchy(
      {
        organization: { id: "1", name: "Org One" },
        projects: [{ id: "prj-1", name: "Adidas" }],
      },
      { id: "1", name: "Org One", slug: "org-one" },
    );
    const secondHierarchy = normalizeProjectContextHierarchy(
      {
        organization: { id: "2", name: "Org Two" },
        projects: [{ id: "prj-2", name: "Nike" }],
      },
      { id: "2", name: "Org Two", slug: "org-two" },
    );

    const context = findResolvedProjectContext(
      [firstHierarchy, secondHierarchy].filter(
        (value): value is NonNullable<typeof value> => value !== null,
      ),
      "prj-1",
      "2",
    );

    expect(context).toBe(null);
  });
});
