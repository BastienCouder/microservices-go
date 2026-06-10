import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./use-optimization-errors.ts", import.meta.url)).text();
const errorHubColumnSource = await Bun.file(
  new URL("../../../error-hub/_components/error-hub-column.tsx", import.meta.url),
).text();

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
    expect(errorHubColumnSource.includes("actionStatus={actionStatusesByErrorId.get(error.id)}")).toBe(true);
    expect(errorHubColumnSource.includes("onMarkDone ? () => void onMarkDone(error) : undefined")).toBe(true);
    expect(errorHubColumnSource.includes("markingActionDone={markingDoneErrorIds.has(error.id)}")).toBe(true);
  });

  test("does not abort the error hub board request during route context churn", () => {
    expect(source.includes("queryFn: () => loadOptimizationErrors(apiBaseURL, routeSearch),")).toBe(true);
    expect(source.includes("queryFn: ({ signal }) => loadOptimizationErrors(apiBaseURL, routeSearch, { signal })")).toBe(false);
  });
});
