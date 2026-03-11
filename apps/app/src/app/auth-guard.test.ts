import { describe, expect, test } from "bun:test";

import { shouldRedirectUnauthenticated } from "./auth-guard";

describe("shouldRedirectUnauthenticated", () => {
  test("returns true when the app is idle and no authenticated user is available", () => {
    expect(
      shouldRedirectUnauthenticated({
        apiBaseURL: "http://localhost:50000",
        busy: false,
        user: null,
      }),
    ).toBe(true);
  });

  test("returns false while the session request is still loading", () => {
    expect(
      shouldRedirectUnauthenticated({
        apiBaseURL: "http://localhost:50000",
        busy: true,
        user: null,
      }),
    ).toBe(false);
  });

  test("returns false when the app has no API base URL configured", () => {
    expect(
      shouldRedirectUnauthenticated({
        apiBaseURL: "",
        busy: false,
        user: null,
      }),
    ).toBe(false);
  });

  test("returns false when an authenticated user is present", () => {
    expect(
      shouldRedirectUnauthenticated({
        apiBaseURL: "http://localhost:50000",
        busy: false,
        user: {
          ID: 1,
          AuthIdentityID: "kratos-id",
          Email: "user@example.com",
          FirstName: "Test",
          LastName: "User",
          Banned: false,
          CreatedAt: "2026-03-10T00:00:00Z",
        },
      }),
    ).toBe(false);
  });
});
