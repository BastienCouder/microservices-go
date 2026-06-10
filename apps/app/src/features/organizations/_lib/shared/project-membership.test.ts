import { describe, expect, test } from "bun:test";

import {
  ASSIGNABLE_ORGANIZATION_ROLES,
  getMemberActionPolicy,
  INVITABLE_ORGANIZATION_ROLES,
} from "./project-membership";

describe("organization role options", () => {
  test("exposes only editor and viewer for organization role assignment", () => {
    expect([...ASSIGNABLE_ORGANIZATION_ROLES]).toEqual(["editor", "viewer"]);
  });

  test("exposes only editor and viewer for organization invitations", () => {
    expect([...INVITABLE_ORGANIZATION_ROLES]).toEqual(["editor", "viewer"]);
  });

  test("does not expose member banning as an organization action", () => {
    const policy = getMemberActionPolicy({
      actorRoles: ["editor"],
      targetRoles: ["viewer"],
    });

    expect("canSetBanned" in policy).toBe(false);
  });

  test("does not expose actions for the current user row", () => {
    const policy = getMemberActionPolicy({
      actorRoles: ["editor"],
      targetRoles: ["viewer"],
      isCurrentUser: true,
    });

    expect(policy).toEqual({
      showActions: false,
      canEditRoles: false,
      canEditProjects: false,
      canRemoveMember: false,
      canAssignOwnerRole: false,
    });
  });
});
