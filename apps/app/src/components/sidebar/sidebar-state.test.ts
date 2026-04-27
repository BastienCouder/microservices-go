import { describe, expect, test } from "bun:test";

import {
  normalizeOrganizationHierarchy,
  selectPreferredID,
} from "./sidebar-state";

describe("sidebar state helpers", () => {
  test("selectPreferredID returns the first available candidate", () => {
    expect(
      selectPreferredID({
        candidates: ["route-org", "stored-org", "first-org"],
        availableIds: ["stored-org", "first-org"],
      }),
    ).toBe("stored-org");
  });

  test("selectPreferredID falls back to the provided fallback when none match", () => {
    expect(
      selectPreferredID({
        candidates: ["missing-route", "missing-store"],
        availableIds: ["a", "b"],
        fallback: "a",
      }),
    ).toBe("a");
  });

  test("normalizeOrganizationHierarchy supports legacy payload keys", () => {
    const hierarchy = normalizeOrganizationHierarchy(
      {
        success: true,
        data: {
          Organization: {
            ID: "org_1",
            Name: "Acme",
          },
          Projects: [
            {
              ID: "proj_1",
              OrganizationID: "org_1",
              Name: "Website",
              BrandName: "Acme Brand",
            },
          ],
        },
      },
      "fallback-org",
    );

    expect(hierarchy).toEqual({
      organization: {
        id: "org_1",
        slug: "acme",
        name: "Acme",
        ownerIdentityId: "",
        createdAt: "",
        deletedAt: null,
      },
      projects: [
        {
          id: "proj_1",
          slug: "website",
          organizationId: "org_1",
          name: "Website",
          status: "draft",
          brandName: "Acme Brand",
          brandDescription: "",
          attributionSource: "",
          createdAt: "",
        },
      ],
    });
  });
});
