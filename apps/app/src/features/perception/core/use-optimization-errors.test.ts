import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./use-optimization-errors.ts", import.meta.url)).text();
const errorHubSource = await Bun.file(new URL("../../error-hub/index.tsx", import.meta.url)).text();

describe("useOptimizationErrors", () => {
  test("creates AI optimize actions in processing status and exposes done transitions", () => {
    expect(source.includes('status: "processing"')).toBe(true);
    expect(source.includes('createdBy: "ai"')).toBe(true);
    expect(source.includes("actionStatusesByErrorId")).toBe(true);
    expect(source.includes("handleMarkDone")).toBe(true);
    expect(source.includes('status: "done"')).toBe(true);
    expect(source.includes("getOptimizationActionMatchIds")).toBe(true);
  });

  test("error hub passes action status and done handler to error cards", () => {
    expect(errorHubSource.includes("actionStatus={actionStatusesByErrorId.get(error.id)}")).toBe(true);
    expect(errorHubSource.includes("onMarkActionDone={() => void onMarkDone(error)}")).toBe(true);
    expect(errorHubSource.includes("markingActionDone={markingDoneErrorIds.has(error.id)}")).toBe(true);
  });
});
