import { describe, expect, test } from "bun:test";

import {
  isNumericOrganizationId,
  resolveNumericOrganizationIdFromMemberships,
  resolveNumericOrganizationIdFromSummaries,
  type UserOrganizationMembership,
  type UserOrganizationSummary,
} from "./organizations";

const MEMBERSHIPS: UserOrganizationMembership[] = [
  {
    organizationId: "7",
    internalId: "7",
    publicId: "org_2b4d3323672e548ce3395386",
    role: "editor",
  },
];

const ORGANIZATIONS: UserOrganizationSummary[] = [
  {
    id: "7",
    internalId: "7",
    publicId: "org_2b4d3323672e548ce3395386",
    name: "Fury Defendu",
    slug: "fury-defendu",
    role: "editor",
  },
];

describe("organization id resolution", () => {
  test("recognizes numeric billing organization ids", () => {
    expect(isNumericOrganizationId("7")).toBe(true);
    expect(isNumericOrganizationId("007")).toBe(false);
    expect(isNumericOrganizationId("org_2b4d3323672e548ce3395386")).toBe(false);
  });

  test("resolves numeric organization ids from memberships", () => {
    expect(
      resolveNumericOrganizationIdFromMemberships(
        MEMBERSHIPS,
        "org_2b4d3323672e548ce3395386",
      ),
    ).toBe("7");
  });

  test("falls back to organization summaries for slug-based routes", () => {
    expect(
      resolveNumericOrganizationIdFromSummaries(ORGANIZATIONS, "fury-defendu"),
    ).toBe("7");
  });
});
