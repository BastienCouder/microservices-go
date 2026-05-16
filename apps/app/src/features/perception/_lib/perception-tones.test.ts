import { describe, expect, test } from "bun:test";

import {
  getPerceptionActionStatusTone,
  getPerceptionPriorityTone,
} from "./perception-tones";

describe("perception tones", () => {
  test("centralizes priority badge colors", () => {
    expect(getPerceptionPriorityTone("high")).toBe("border-transparent bg-destructive/10 text-destructive");
    expect(getPerceptionPriorityTone("medium")).toBe("border-transparent bg-amber-500/10 text-amber-700");
    expect(getPerceptionPriorityTone("low")).toBe("border-transparent bg-green-500/10 text-green-700");
  });

  test("centralizes action status badge colors", () => {
    expect(getPerceptionActionStatusTone("processing")).toBe("border-blue-500/30 bg-blue-500/10 text-blue-700");
    expect(getPerceptionActionStatusTone("done")).toBe("border-green-500/30 bg-green-500/10 text-green-700");
    expect(getPerceptionActionStatusTone("draft")).toBe("border-border bg-muted/50 text-muted-foreground");
  });
});
