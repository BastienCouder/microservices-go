import { describe, expect, test } from "bun:test";

import {
  clearSelectedProjectContext,
  clearProjectContextSearch,
  clearSelectedContext,
  readProjectIdFromSearch,
  readProjectTokenFromSearch,
  readSelectedOrganizationID,
  readSelectedOrganizationPublicID,
  readSelectedProjectID,
  resolveSelectedContextSearch,
  storeSelectedOrganizationContext,
  storeSelectedProjectContext,
} from "./selection";

describe("selection helpers", () => {
  test("reads a project token from either slug or opaque id routes", () => {
    expect(readProjectTokenFromSearch("?project=acme")).toBe("acme");
    expect(readProjectTokenFromSearch("?project=prj_123")).toBe("prj_123");
    expect(readProjectTokenFromSearch("?projectId=prj-123")).toBe("prj-123");
  });

  test("keeps project id parsing restricted to opaque project ids", () => {
    expect(readProjectIdFromSearch("?project=acme")).toBe("");
    expect(readProjectIdFromSearch("?project=prj_123")).toBe("prj_123");
    expect(readProjectIdFromSearch("?project=prj-123")).toBe("prj-123");
  });

  test("clears stale project and organization route context together", () => {
    expect(
      clearProjectContextSearch(
        "?project=kahier&projectId=prj_123&organizationId=org-1&section=members",
      ),
    ).toBe("?section=members");
  });

  test("clears the stored organization and project context", () => {
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
        dispatchEvent: () => true,
      },
    });

    storeSelectedProjectContext({
      organizationId: "org-1",
      projectId: "prj_123",
    });

    clearSelectedContext();

    expect(readSelectedOrganizationID()).toBe("");
    expect(readSelectedOrganizationPublicID()).toBe("");
    expect(readSelectedProjectID()).toBe("");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("stores a public organization id separately from the internal id", () => {
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
        dispatchEvent: () => true,
      },
    });

    storeSelectedOrganizationContext({
      organizationId: "2",
      publicId: "org_a1b2c3d4",
    });

    expect(readSelectedOrganizationID()).toBe("2");
    expect(readSelectedOrganizationPublicID()).toBe("2");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("clears only the stored project context without dropping the organization", () => {
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
        dispatchEvent: () => true,
      },
    });

    storeSelectedOrganizationContext({
      organizationId: "org-1",
      publicId: "org_public_1",
    });
    storeSelectedProjectContext({
      organizationId: "org-1",
      projectId: "prj_123",
    });

    clearSelectedProjectContext();

    expect(readSelectedOrganizationID()).toBe("org-1");
    expect(readSelectedOrganizationPublicID()).toBe("org-1");
    expect(readSelectedProjectID()).toBe("");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("restores the stored project selection with a canonical projectId query param", () => {
    const storage = new Map<string, string>();
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
        dispatchEvent: () => true,
      },
    });

    storeSelectedOrganizationContext({
      organizationId: "org-1",
      publicId: "org_public_1",
    });
    storeSelectedProjectContext({
      organizationId: "org-1",
      projectId: "prj_123",
    });

    expect(resolveSelectedContextSearch("?section=members")).toBe(
      "?section=members&projectId=prj_123&organizationId=org-1",
    );

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("drops the legacy last-selected project token when storing a project id", () => {
    const storage = new Map<string, string>([
      ["last-selected-project-token", "legacy-project-slug"],
    ]);
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
        dispatchEvent: () => true,
      },
    });

    storeSelectedProjectContext({
      organizationId: "org-1",
      projectId: "prj_123",
    });

    expect(storage.has("last-selected-project-token")).toBe(false);
    expect(readSelectedProjectID()).toBe("prj_123");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  test("drops the legacy internal organization key when storing organization context", () => {
    const storage = new Map<string, string>([
      ["selected-organization-internal-id", "7"],
    ]);
    const originalWindow = globalThis.window;

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => {
            storage.set(key, value);
          },
          removeItem: (key: string) => {
            storage.delete(key);
          },
        },
        dispatchEvent: () => true,
      },
    });

    storeSelectedOrganizationContext({
      organizationId: "42",
      publicId: "org_public_42",
    });

    expect(storage.get("selected-organization-id")).toBe("42");
    expect(storage.has("selected-organization-internal-id")).toBe(false);
    expect(readSelectedOrganizationID()).toBe("42");

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: originalWindow,
    });
  });
});
