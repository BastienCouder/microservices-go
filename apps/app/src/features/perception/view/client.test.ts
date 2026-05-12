import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./client.tsx", import.meta.url)).text();

describe("perception client layout", () => {
  test("keeps generated actions in the middle column and wires fix buttons", () => {
    expect(source.includes("PerceptionOptimizeActions")).toBe(true);
    expect(source.includes("drafts={viewModel.optimizeDrafts}")).toBe(true);
    expect(source.includes("persistError={viewModel.persistError}")).toBe(true);
    expect(source.includes("onCreateAction={viewModel.handleFix}")).toBe(true);
    expect(source.includes("generatedIds={viewModel.generatedIds}")).toBe(true);
    expect(source.includes("savingErrorIds={viewModel.savingErrorIds}")).toBe(true);
  });
});
