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

  test("keeps the selection limit unset until billing entitlements are resolved", () => {
    expect(dataSource.includes("const resolvedSelectionLimit = billingQuery.data")).toBe(true);
    expect(dataSource.includes("const selectionLimitReady =")).toBe(true);
    expect(dataSource.includes("resolvedSelectionLimit ??")).toBe(true);
  });

  test("keeps the opaque project id in the canonical models redirect", () => {
    const redirectBlock = viewModelSource.slice(
      viewModelSource.indexOf('buildScopedHref("/models"'),
      viewModelSource.indexOf("  }, [", viewModelSource.indexOf('buildScopedHref("/models"')),
    );
    expect(redirectBlock.includes("project: data.selectedProject.id")).toBe(true);
    expect(redirectBlock.includes("organizationId")).toBe(false);
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
