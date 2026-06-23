import { describe, expect, test } from "bun:test";

import {
  applyResolvedProjectContextSearch,
  findResolvedProjectContext,
} from "./project-context";

describe("project context", () => {
  const hierarchies = [
    {
      organization: {
        id: "org-1",
        publicId: "org_public_1",
        slug: "acme-org",
        name: "Acme Org",
      },
      projects: [
        {
          id: "prj_123",
          slug: "acme",
          organizationId: "org-1",
          name: "Acme",
        },
      ],
    },
  ];

  test("resolves a project context from a slug token", () => {
    expect(findResolvedProjectContext(hierarchies, "acme")).toEqual({
      organizationId: "org-1",
      organizationPublicId: "org_public_1",
      organizationSlug: "acme-org",
      projectId: "prj_123",
      projectSlug: "acme",
      projectName: "Acme",
    });
  });

  test("falls back to the matching project organization when the scoped organization token is stale", () => {
    expect(findResolvedProjectContext(hierarchies, "acme", "stale-org")).toEqual({
      organizationId: "org-1",
      organizationPublicId: "org_public_1",
      organizationSlug: "acme-org",
      projectId: "prj_123",
      projectSlug: "acme",
      projectName: "Acme",
    });
  });

  test("keeps canonical route context on project slug without organization tokens", () => {
    const context = findResolvedProjectContext(hierarchies, "prj_123");

    expect(
      applyResolvedProjectContextSearch(
        "?projectId=prj_123&organizationId=org-1&section=members&tab=responses",
        context,
      ),
    ).toBe("?section=members&tab=responses&project=acme");
  });
});
