import { describe, expect, test } from "bun:test";

import { apiRoutes } from "@/lib/api-config";

describe("prompt run API route", () => {
  test("uses the project analysis execution endpoint", () => {
    expect(apiRoutes.analysis.analyze("project-1")).toBe("/analysis/projects/project-1/run");
  });
});
