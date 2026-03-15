import { describe, expect, test } from "bun:test";

import { countHierarchyBrands, groupProjectsByBrand, normalizeOrganizationHierarchy } from "./hierarchy";

describe("normalizeOrganizationHierarchy", () => {
  test("normalizes the backend hierarchy payload into frontend-friendly shapes", () => {
    const result = normalizeOrganizationHierarchy({
      organization: {
        ID: 42,
        Name: "Acme Holdings",
        OwnerIdentityID: 7,
        CreatedAt: "2026-03-15T09:00:00Z",
      },
      projects: [
        {
          id: "project-1",
          organizationId: 42,
          name: "Search visibility",
          status: "active",
          brandName: "Acme",
          brandDescription: "Parent brand",
          attributionSource: "ga4",
          createdAt: "2026-03-10T08:00:00Z",
        },
      ],
    });

    expect(result).toEqual({
      organization: {
        id: "42",
        name: "Acme Holdings",
        ownerIdentityId: "7",
        createdAt: "2026-03-15T09:00:00Z",
        deletedAt: null,
      },
      projects: [
        {
          id: "project-1",
          organizationId: "42",
          name: "Search visibility",
          status: "active",
          brandName: "Acme",
          brandDescription: "Parent brand",
          attributionSource: "ga4",
          createdAt: "2026-03-10T08:00:00Z",
        },
      ],
    });
  });

  test("falls back to the selected organization when the hierarchy has no explicit organization payload", () => {
    const result = normalizeOrganizationHierarchy(
      {
        projects: [
          {
            id: "project-2",
            name: "Acquisition funnel",
          },
        ],
      },
      "99",
      "Fallback Org",
    );

    expect(result?.organization).toEqual({
      id: "99",
      name: "Fallback Org",
      ownerIdentityId: "",
      createdAt: "",
      deletedAt: null,
    });
  });
});

describe("groupProjectsByBrand", () => {
  test("groups projects by brand name and keeps unassigned projects last", () => {
    const groups = groupProjectsByBrand([
      {
        id: "project-b",
        organizationId: "42",
        name: "Brand B",
        status: "paused",
        brandName: "",
        brandDescription: "",
        attributionSource: "",
        createdAt: "",
      },
      {
        id: "project-a",
        organizationId: "42",
        name: "Brand A",
        status: "active",
        brandName: "Acme",
        brandDescription: "Core brand",
        attributionSource: "",
        createdAt: "",
      },
      {
        id: "project-c",
        organizationId: "42",
        name: "Brand C",
        status: "draft",
        brandName: "acme",
        brandDescription: "",
        attributionSource: "",
        createdAt: "",
      },
    ]);

    expect(groups.map((group) => group.name)).toEqual(["Acme", "No brand"]);
    expect(groups[0]?.projects.map((project) => project.name)).toEqual(["Brand A", "Brand C"]);
    expect(groups[1]?.isUnassigned).toBe(true);
  });
});

describe("countHierarchyBrands", () => {
  test("counts distinct named brands and ignores empty values", () => {
    const count = countHierarchyBrands([
      {
        id: "project-1",
        organizationId: "42",
        name: "One",
        status: "active",
        brandName: "Acme",
        brandDescription: "",
        attributionSource: "",
        createdAt: "",
      },
      {
        id: "project-2",
        organizationId: "42",
        name: "Two",
        status: "active",
        brandName: " acme ",
        brandDescription: "",
        attributionSource: "",
        createdAt: "",
      },
      {
        id: "project-3",
        organizationId: "42",
        name: "Three",
        status: "active",
        brandName: "",
        brandDescription: "",
        attributionSource: "",
        createdAt: "",
      },
    ]);

    expect(count).toBe(1);
  });
});
