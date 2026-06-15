import { describe, expect, test } from "bun:test";

import { normalizeProject } from "./api-normalizers";

describe("organization api normalizers", () => {
  test("does not expose project status in normalized projects", () => {
    const project = normalizeProject({
      id: "prj-1",
      organizationId: 42,
      name: "Acme",
      status: "draft",
    });

    expect(project).toEqual({
      id: "prj-1",
      slug: "",
      organizationId: "42",
      name: "Acme",
      brandName: "",
      attributionSource: "",
      createdAt: "",
    });
    expect(Object.hasOwn(project ?? {}, "status")).toBe(false);
  });
});
