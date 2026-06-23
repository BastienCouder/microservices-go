import { describe, expect, test } from "bun:test";

import { projectScopeQueryKeys } from "./query-refresh";

describe("project scope query invalidation", () => {
  test("includes organization-scoped monitoring, perception, and optimization error keys", () => {
    expect(
      projectScopeQueryKeys("http://api.test", "org-9", "project-1"),
    ).toEqual([
      ["projects", "details", "http://api.test", "org-9", "project-1"],
      ["models", "project", "http://api.test", "org-9", "project-1"],
      ["models", "llm-provider-credentials", "http://api.test", "org-9", "project-1"],
      ["prompt-quota", "http://api.test", "org-9", "project-1"],
      ["monitoring", "http://api.test", "org-9", "project-1"],
      ["perception", "http://api.test", "org-9", "project-1"],
      ["optimization-errors", "http://api.test", "org-9", "project-1"],
      ["traffic", "http://api.test", "org-9", "project-1"],
      ["prompts", "http://api.test", "org-9", "project-1"],
      ["prompts", "catalog", "http://api.test", "org-9", "project-1"],
    ]);
  });
});
