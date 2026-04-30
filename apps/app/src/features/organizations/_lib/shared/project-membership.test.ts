import { describe, expect, test } from "bun:test";

import {
  ASSIGNABLE_ORGANIZATION_ROLES,
  getMemberActionPolicy,
  INVITABLE_ORGANIZATION_ROLES,
} from "./project-membership";

describe("organization role options", () => {
  test("exposes only admin and member for organization role assignment", () => {
    expect([...ASSIGNABLE_ORGANIZATION_ROLES]).toEqual(["admin", "member"]);
  });

  test("exposes only admin and member for organization invitations", () => {
    expect([...INVITABLE_ORGANIZATION_ROLES]).toEqual(["admin", "member"]);
  });

  test("does not expose member banning as an organization action", () => {
    const policy = getMemberActionPolicy({
      actorRoles: ["admin"],
      targetRoles: ["member"],
    });

    expect("canSetBanned" in policy).toBe(false);
  });

  test("does not expose actions for the current user row", () => {
    const policy = getMemberActionPolicy({
      actorRoles: ["admin"],
      targetRoles: ["member"],
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
