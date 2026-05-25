import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./step-analysis.tsx", import.meta.url)).text();

describe("step analysis", () => {
  test("keeps only the progress UI and exposes a retry path on failure", () => {
    expect(source.includes("analysisRetry")).toBe(true);
    expect(source.includes("creationError")).toBe(true);
    expect(source.includes("setProgress(10)")).toBe(true);
    expect(source.includes("!createdProjectId || creationError")).toBe(true);
    expect(source.includes("navigate(monitoringHref)")).toBe(true);
    expect(source.includes("setTimeout")).toBe(true);
    expect(source.includes("<OnboardingStepFooter")).toBe(false);
    expect(source.includes('t("goToMonitoring")')).toBe(false);

    expect(source.includes('t("analysisWebsite"')).toBe(false);
    expect(source.includes('t("analysisAttribution"')).toBe(false);
    expect(source.includes('t("analysisCompetitors"')).toBe(false);
    expect(source.includes('t("analysisPrompts"')).toBe(false);
    expect(source.includes('t("analysisVisibility"')).toBe(false);
    expect(source.includes('t("analysisDescription"')).toBe(false);
  });

  test("sends project creation only once per attempt", () => {
    expect(source.includes("startedAttemptRef")).toBe(true);
    expect(source.includes("startedAttemptRef.current === attempt")).toBe(true);
    expect(source.includes("startedAttemptRef.current = attempt")).toBe(true);
  });
});
