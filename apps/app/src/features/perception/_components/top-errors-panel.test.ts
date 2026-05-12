import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./top-errors-panel.tsx", import.meta.url)).text();

describe("top errors panel", () => {
  test("renders fix buttons on error cards when action creation is available", () => {
    expect(source.includes("actionGenerated={generatedIds?.has(error.id) ?? false}")).toBe(true);
    expect(source.includes("actionSaving={savingErrorIds?.has(error.id) ?? false}")).toBe(true);
    expect(source.includes("onCreateAction ? () => void onCreateAction(error) : undefined")).toBe(true);
    expect(source.includes("{actionGenerated ? t(\"topErrorsAdded\") : t(\"topErrorsFix\")}")).toBe(true);
  });
});
