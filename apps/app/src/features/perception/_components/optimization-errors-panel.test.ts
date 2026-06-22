import { describe, expect, test } from "bun:test";

const source = await Bun.file(
  new URL("./optimization-errors-panel.tsx", import.meta.url),
).text();

describe("optimization errors panel", () => {
  test("hides card footers on the perception panel while keeping action wiring available", () => {
    expect(
      source.includes("actionGenerated={generatedIds?.has(error.id) ?? false}"),
    ).toBe(true);
    expect(
      source.includes("actionSaving={savingErrorIds?.has(error.id) ?? false}"),
    ).toBe(true);
    expect(source.includes("modelLookup={modelLookup}")).toBe(true);
    expect(source.includes("export function buildPerceptionModelLookup")).toBe(
      true,
    );
    expect(source.includes("getPerceptionModelBadgeMeta")).toBe(true);
    expect(source.includes("{modelBadge.provider} - {modelBadge.name}")).toBe(
      true,
    );
    expect(
      source.includes(
        "onCreateAction ? () => void onCreateAction(error) : undefined",
      ),
    ).toBe(true);
    expect(source.includes('actionStatus === "done"')).toBe(true);
    expect(source.includes("canMarkDone")).toBe(true);
    expect(source.includes('t("optimizationErrorsMarkDone")')).toBe(true);
    expect(source.includes("hideAddedErrors")).toBe(false);
    expect(source.includes("onRemoveAction")).toBe(true);
    expect(source.includes("optimizationErrorsRemove")).toBe(true);
    expect(source.includes("const canRemoveAction")).toBe(true);
    expect(source.includes("const shouldShowActionButton")).toBe(true);
    expect(source.includes("hideFooter")).toBe(true);
    expect(source.includes("{hideFooter ? null : (")).toBe(true);
    expect(source.includes("showProviderIconsOnly")).toBe(true);
    expect(source.includes("showIndex={false}")).toBe(true);
    expect(source.includes("function getUniqueProviderModelBadges")).toBe(true);
    expect(source.includes("seenProviders.has(providerKey)")).toBe(true);
    expect(source.includes("title={modelBadge.provider}")).toBe(true);
    expect(source.includes("showProviderIconsOnly ? (")).toBe(true);
    expect(
      source.includes("mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3"),
    ).toBe(true);
    expect(source.includes("getPriorityDotTone")).toBe(false);
    expect(source.includes('actionStatus === "done" && !canRemoveAction')).toBe(
      true,
    );
    expect(
      source.includes(
        'actionStatus === "done"\n                  ? formatPerceptionStatusLabelI18n("done", locale)',
      ),
    ).toBe(false);
    expect(
      source.includes("getPerceptionPriorityTone(error.optimizePriority)"),
    ).toBe(true);
    expect(source.includes("getPerceptionActionStatusTone(actionStatus)")).toBe(
      true,
    );
    expect(source.includes("function getPriorityTone")).toBe(false);
    expect(source.includes("function getActionStatusTone")).toBe(false);
    expect(
      source.includes(
        'error.optimizePriority === "high" ? "destructive" : "secondary"',
      ),
    ).toBe(false);
    expect(source.includes("totalErrorCount = errors.length")).toBe(true);
    expect(source.includes('buildScopedHref("/error-hub"')).toBe(true);
    expect(source.includes('source: "perception"')).toBe(true);
    expect(source.includes("<Link to={seeMoreHref}>")).toBe(true);
  });
});
