import { describe, expect, test } from "bun:test";

import {
  resolveBillingOrganizationIdForModels,
  resolveSelectedProjectForModels,
} from "./use-models-panel-data";

const dataSource = await Bun.file(
  new URL("./use-models-panel-data.ts", import.meta.url),
).text();
const viewModelSource = await Bun.file(
  new URL("./use-models-panel-view-model.ts", import.meta.url),
).text();

describe("resolveSelectedProjectForModels", () => {
  const projects = [
    { id: "prj-1", slug: "acme", organizationId: "org-1", name: "Acme" },
    { id: "prj-2", slug: "nike", organizationId: "org-1", name: "Nike" },
  ];

  test("falls back to the first project only when no project is requested", () => {
    expect(resolveSelectedProjectForModels(projects, "")).toEqual({
      selectedProjectId: "prj-1",
      hasMissingHintedProject: false,
    });
  });

  test("resolves a project by canonical id without fallback", () => {
    expect(resolveSelectedProjectForModels(projects, "prj-2")).toEqual({
      selectedProjectId: "prj-2",
      hasMissingHintedProject: false,
    });
  });

  test("resolves a project by slug without falling back", () => {
    expect(resolveSelectedProjectForModels(projects, "nike")).toEqual({
      selectedProjectId: "prj-2",
      hasMissingHintedProject: false,
    });
  });

  test("resolves project tokens within the current organization scope", () => {
    expect(dataSource.includes("organizationId,")).toBe(true);
    expect(dataSource.includes("resolveProjectTokenToContext(apiBaseURL")).toBe(true);
    expect(dataSource.includes("resolvedProjectContextQuery.data?.projectId || hintedProjectToken")).toBe(true);
  });

  test("uses the stored internal organization id when the url hides organization context", () => {
    expect(viewModelSource.includes("readSelectedOrganizationID")).toBe(true);
    expect(viewModelSource.includes("return readSelectedOrganizationPublicID();")).toBe(false);
  });

  test("keeps the selection limit unset until billing entitlements are resolved", () => {
    expect(dataSource.includes("const resolvedSelectionLimit = billingQuery.data")).toBe(true);
    expect(dataSource.includes("const selectionLimitReady =")).toBe(true);
    expect(dataSource.includes("resolvedSelectionLimit ??")).toBe(true);
  });

  test("keeps the public project slug in the canonical models redirect", () => {
    expect(viewModelSource.includes("hintedProject === data.selectedProject.slug")).toBe(true);
    expect(viewModelSource.includes("project: data.selectedProject.slug || data.selectedProject.id")).toBe(true);
    expect(viewModelSource.includes('buildScopedHref("/models", {')).toBe(true);
  });
});

describe("resolveBillingOrganizationIdForModels", () => {
  test("uses the selected project's numeric organization id", () => {
    expect(
      resolveBillingOrganizationIdForModels(
        [
          { id: "prj-1", organizationId: "1" },
          { id: "prj-2", organizationId: "2" },
        ],
        "prj-2",
        "org_public",
      ),
    ).toBe("2");
  });

  test("falls back to the first project's numeric organization id", () => {
    expect(
      resolveBillingOrganizationIdForModels(
        [{ id: "prj-1", organizationId: "1" }],
        "",
        "org_public",
      ),
    ).toBe("1");
  });

  test("ignores public organization ids for billing quotas", () => {
    expect(
      resolveBillingOrganizationIdForModels(
        [{ id: "prj-1", organizationId: "org_public" }],
        "prj-1",
        "org_public",
      ),
    ).toBe("");
  });
});
