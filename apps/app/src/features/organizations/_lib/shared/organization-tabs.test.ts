import { describe, expect, test } from "bun:test";

import {
  canManageOrganizationPages,
  DEFAULT_ORGANIZATION_VIEW_TAB,
  getOrganizationViewTabsForRoles,
  isOrganizationViewTabAvailable,
  ORGANIZATION_VIEW_TABS,
} from "./constants";

describe("organization view tabs", () => {
  test("exposes the organization sections as pages for the secondary sidebar", () => {
    expect(ORGANIZATION_VIEW_TABS.map((tab) => tab.value)).toEqual([
      "projects",
      "members",
      "invitations",
      "settings",
      "apiKeys",
    ]);
    expect(ORGANIZATION_VIEW_TABS.map((tab) => tab.label)).toEqual([
      "Projects",
      "Users",
      "Invitations",
      "Settings",
      "API keys",
    ]);
    expect(ORGANIZATION_VIEW_TABS.at(-1)).toEqual({
      value: "apiKeys",
      label: "API keys",
    });
  });

  test("keeps projects as the default organization tab", () => {
    expect(DEFAULT_ORGANIZATION_VIEW_TAB).toBe("projects");
  });

  test("keeps restricted organization tabs for managers only", () => {
    expect(canManageOrganizationPages(["viewer"])).toBe(false);
    expect(canManageOrganizationPages(["editor"])).toBe(true);
    expect(canManageOrganizationPages(["super_admin"])).toBe(false);
    expect(getOrganizationViewTabsForRoles(["viewer"]).map((tab) => tab.value)).toEqual([
      "projects",
      "members",
    ]);
    expect(isOrganizationViewTabAvailable("apiKeys", ["viewer"])).toBe(false);
    expect(isOrganizationViewTabAvailable("apiKeys", ["editor"])).toBe(true);
  });
});
