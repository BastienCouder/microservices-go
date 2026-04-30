import { afterEach, describe, expect, test } from "bun:test";

import {
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

  test("keeps explicit route project scope and adds stored organization context", () => {
    installMockWindow();

    storeSelectedOrganizationID("org-1");
    storeSelectedProjectID("project-1");

    expect(resolveSelectedContextSearch("?project=acme")).toBe(
      "?project=acme&organizationId=org-1",
    );
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
});
