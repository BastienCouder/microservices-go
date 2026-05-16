import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./top-errors-panel.tsx", import.meta.url)).text();

describe("top errors panel", () => {
  test("renders fix buttons on error cards when action creation is available", () => {
    expect(source.includes("actionGenerated={generatedIds?.has(error.id) ?? false}")).toBe(true);
    expect(source.includes("actionSaving={savingErrorIds?.has(error.id) ?? false}")).toBe(true);
    expect(source.includes("modelLookup={modelLookup}")).toBe(true);
    expect(source.includes("export function buildPerceptionModelLookup")).toBe(true);
    expect(source.includes("getPerceptionModelBadgeMeta")).toBe(true);
    expect(source.includes("{modelBadge.provider} - {modelBadge.name}")).toBe(true);
    expect(source.includes("onCreateAction ? () => void onCreateAction(error) : undefined")).toBe(true);
    expect(source.includes("actionStatus === \"done\"")).toBe(true);
    expect(source.includes("canMarkDone")).toBe(true);
    expect(source.includes("t(\"topErrorsMarkDone\")")).toBe(true);
    expect(source.includes("hideAddedErrors")).toBe(false);
    expect(source.includes("topErrorsHideAdded")).toBe(false);
    expect(source.includes("onRemoveAction")).toBe(true);
    expect(source.includes("topErrorsRemove")).toBe(true);
    expect(source.includes("const canRemoveAction")).toBe(true);
    expect(source.includes("const shouldShowActionButton")).toBe(true);
    expect(source.includes('actionStatus === "done" && !canRemoveAction')).toBe(true);
    expect(source.includes('actionStatus === "done"\n                  ? formatPerceptionStatusLabelI18n("done", locale)')).toBe(false);
    expect(source.includes("getPerceptionPriorityTone(error.optimizePriority)")).toBe(true);
    expect(source.includes("getPerceptionActionStatusTone(actionStatus)")).toBe(true);
    expect(source.includes("function getPriorityTone")).toBe(false);
    expect(source.includes("function getActionStatusTone")).toBe(false);
    expect(source.includes("error.optimizePriority === \"high\" ? \"destructive\" : \"secondary\"")).toBe(false);
  });
});
