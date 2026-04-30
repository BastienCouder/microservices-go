import { describe, expect, test } from "bun:test";

import { buildAccountProfileViewData } from "./account-profile-view-data";
import type { UserProfile } from "@/shared/models";

const activeUser: UserProfile = {
  ID: 42,
  AuthIdentityID: "ory-identity-123",
  Email: "ada@example.com",
  FirstName: "Ada",
  LastName: "Lovelace",
  Banned: false,
  CreatedAt: "2026-04-01T08:30:00Z",
  DeletedAt: null,
  BannedAt: null,
};

describe("buildAccountProfileViewData", () => {
  test("keeps only readonly identity fields for the account page", () => {
    const view = buildAccountProfileViewData(activeUser);

    expect(Object.keys(view).sort()).toEqual(["email", "firstName", "lastName"]);
    expect(view.email).toBe("ada@example.com");
    expect(view.firstName).toBe("Ada");
    expect(view.lastName).toBe("Lovelace");
  });
});
