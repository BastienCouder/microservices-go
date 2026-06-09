import { afterEach, describe, expect, test } from "bun:test";

import {
  buildScopedHref,
  keepProjectOnlyContextSearch,
  readOptionalProjectTokenFromSearch,
  readProjectTokenFromSearch,
  resolveSelectedContextSearch,
  storeLastSelectedProjectToken,
  storeSelectedOrganizationID,
  storeSelectedProjectID,
} from "./selection";

const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

function installMockWindow() {
  const target = new EventTarget();
  const values = new Map<string, string>();
  const mockWindow = {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        values.set(key, value);
      },
      removeItem: (key: string) => {
        values.delete(key);
      },
    },
    addEventListener: target.addEventListener.bind(target),
    removeEventListener: target.removeEventListener.bind(target),
    dispatchEvent: target.dispatchEvent.bind(target),
  } as unknown as Window;

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: mockWindow,
    writable: true,
  });

  return mockWindow;
}

afterEach(() => {
  if (originalWindowDescriptor) {
    Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    return;
  }

  Reflect.deleteProperty(globalThis, "window");
});

describe("selection storage", () => {
  test("notifies same-tab listeners when the selected organization changes", () => {
    const mockWindow = installMockWindow();
    let calls = 0;

    mockWindow.addEventListener("app:selected-context-change", () => {
      calls += 1;
    });

    storeSelectedOrganizationID("42");

    expect(calls).toBe(1);
  });

  test("adds stored selection to route searches without project scope", () => {
    installMockWindow();

    storeSelectedOrganizationID("org-1");
    storeSelectedProjectID("project-1");

    expect(resolveSelectedContextSearch("?period=7d")).toBe(
      "?period=7d&project=project-1&organizationId=org-1",
    );
  });

  test("keeps explicit route project scope without injecting a stale stored organization context", () => {
    installMockWindow();

    storeSelectedOrganizationID("org-1");
    storeSelectedProjectID("project-1");

    expect(resolveSelectedContextSearch("?project=acme")).toBe(
      "?project=acme",
    );
  });

  test("does not reuse organization scope from an informational project slug", () => {
    installMockWindow();

    storeSelectedOrganizationID("org-1");
    storeSelectedProjectID("project-1");
    storeLastSelectedProjectToken("adidas");

    expect(resolveSelectedContextSearch("?project=adidas")).toBe("?project=adidas");
  });

  test("prefers the canonical project id when both slug and canonical id are present", () => {
    expect(
      readProjectTokenFromSearch("?project=adidas&projectId=prj_123&organizationId=1"),
    ).toBe("prj_123");
  });

  test("returns null when no project token is present", () => {
    expect(readOptionalProjectTokenFromSearch("?organizationId=1")).toBe(null);
  });

  test("ignores informational project slugs as API project ids", () => {
    expect(readProjectTokenFromSearch("?project=adidas")).toBe("");
    expect(readOptionalProjectTokenFromSearch("?project=adidas")).toBe(null);
    expect(readProjectTokenFromSearch("?project=prj_123")).toBe("prj_123");
  });

  test("keeps explicit route organization scope over stored organization context", () => {
    installMockWindow();

    storeSelectedOrganizationID("org-1");
    storeSelectedProjectID("project-1");

    expect(resolveSelectedContextSearch("?project=acme&org=org-2")).toBe(
      "?project=acme&org=org-2",
    );
  });

  test("prefers the last explicit project token over an overwritten selected project id", () => {
    installMockWindow();

    storeSelectedOrganizationID("org-1");
    storeSelectedProjectID("first-project");
    storeLastSelectedProjectToken("fe");

    expect(resolveSelectedContextSearch("")).toBe(
      "?project=fe&organizationId=org-1",
    );
  });

  test("keeps compact project-only context for organization and account urls", () => {
    expect(
      keepProjectOnlyContextSearch(
        "?project=kahier&projectId=prj-354&org=nike&organizationId=org-1&section=members",
      ),
    ).toBe("?project=kahier&section=members");
  });

  test("replaces compact aliases when building a canonical scoped href", () => {
    expect(
      buildScopedHref("/models?project=adidas&org=org-2", {
        project: "adidas",
        organizationId: "org-1",
      }),
    ).toBe("/models?project=adidas&organizationId=org-1");
  });
});
