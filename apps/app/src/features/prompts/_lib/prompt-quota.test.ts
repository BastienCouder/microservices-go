import { describe, expect, test } from "bun:test";

import {
  PromptQuotaRequestError,
  loadPromptQuotaUsage,
} from "./prompt-quota";

describe("loadPromptQuotaUsage", () => {
  test("rejects empty project ids before sending a quota request", async () => {
    try {
      await loadPromptQuotaUsage("http://api.test", "   ", "org-1");
      throw new Error("expected loadPromptQuotaUsage to reject");
    } catch (error) {
      expect(error instanceof PromptQuotaRequestError).toBe(true);
      expect((error as PromptQuotaRequestError).status).toBe(400);
      expect((error as PromptQuotaRequestError).message).toBe("missing project id");
    }
  });
});
