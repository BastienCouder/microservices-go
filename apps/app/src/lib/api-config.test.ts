import { describe, expect, test } from "bun:test";

import { apiRoutes } from "./api-config";

describe("api routes", () => {
  test("scopes the monitoring prompt list explicitly", () => {
    expect(
      apiRoutes.projects.prompts("project-1", {
        page: 1,
        pageSize: 25,
        kind: "monitoring",
      }),
    ).toBe("/projects/project-1/prompts?page=1&page_size=25&kind=monitoring");
  });
});
