import { describe, expect, test } from "bun:test";

import { resolveSelectedProjectForModels } from "./use-models-panel-data";

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

  test("does not fall back when the requested slug is only informational", () => {
    expect(resolveSelectedProjectForModels(projects, "nike")).toEqual({
      selectedProjectId: "",
      hasMissingHintedProject: true,
    });
  });

  test("resolves project tokens within the current organization scope", () => {
    expect(dataSource.includes("organizationId,")).toBe(true);
    expect(dataSource.includes("resolveProjectTokenToContext(apiBaseURL")).toBe(true);
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
