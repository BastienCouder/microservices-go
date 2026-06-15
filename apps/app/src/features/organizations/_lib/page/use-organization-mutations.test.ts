import { describe, expect, test } from "bun:test";
import { resolveProjectOrganizationId } from "./use-organization-mutations";

describe("resolveProjectOrganizationId", () => {
  test("prefers the organization attached to the project over the selected organization", () => {
    expect(
      resolveProjectOrganizationId(
        [
          {
            id: "prj-302",
            slug: "project-302",
            organizationId: "42",
            name: "Projet",
            brandName: "",
            attributionSource: "",
            createdAt: "2026-05-20T00:00:00Z",
          },
        ],
        "7",
        "prj-302",
      ),
    ).toBe("42");
  });

  test("falls back to the selected organization when the project is not in memory", () => {
    expect(resolveProjectOrganizationId([], "7", "prj-999")).toBe("7");
  });
});
