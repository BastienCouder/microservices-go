import { describe, expect, test } from "bun:test";

import { PERCEPTION_DONUT_COLORS, PERCEPTION_HEATMAP_AXIS_COLORS, PERCEPTION_TEXT } from "@/lib/app-data";

const donutSource = await Bun.file(new URL("./_components/perception-donut-visual.tsx", import.meta.url)).text();
const leftPanelSource = await Bun.file(new URL("./_components/perception-left-panel.tsx", import.meta.url)).text();

describe("perception ui copy", () => {
  test("uses French labels for the main perception page blocks", () => {
    expect(PERCEPTION_TEXT.heatmap.title).toBe("Carte de chaleur modèle × axe");
    expect(PERCEPTION_TEXT.trend.title).toBe("Évolution de la perception");
    expect(PERCEPTION_TEXT.scoreCards.positioning.title).toBe("Clarté du positionnement");
    expect(PERCEPTION_TEXT.optimizeActions.statusPrefix).toBe("Statut");
    expect(PERCEPTION_TEXT.topErrors.fix).toBe("Corriger");
    expect(PERCEPTION_TEXT.trend.series.positioning).toBe("Clarté du positionnement");
    expect(PERCEPTION_TEXT.trend.series.factual).toBe("Fiabilité des informations");
    expect(PERCEPTION_TEXT.trend.series.sentiment).toBe("Tonalité des réponses");
    expect(PERCEPTION_TEXT.filters.groupedMode).toBe("Regrouper IA");
    expect(PERCEPTION_TEXT.filters.uniqueMode).toBe("Par IA");
    expect(PERCEPTION_TEXT.donut.overallLabel).toBe("Score global");
    expect(PERCEPTION_TEXT.donut.bestAxisLabel).toBe("Point fort");
    expect(PERCEPTION_TEXT.donut.weakestAxisLabel).toBe("Point à renforcer");
  });
});

describe("perception chart styling", () => {
  test("reuses the exact same axis colors across the donut and the heatmap", () => {
    expect(PERCEPTION_DONUT_COLORS.axis).toEqual(PERCEPTION_HEATMAP_AXIS_COLORS);
  });

  test("renders donut slices from the shared visible-axis order", () => {
    expect(donutSource.includes("PERCEPTION_VISIBLE_AXES")).toBe(true);
  });

  test("renders a ranked overview instead of the old radial chart", () => {
    expect(donutSource.includes("rankedPoints")).toBe(true);
    expect(donutSource.includes("bestPoint")).toBe(true);
    expect(donutSource.includes("weakestPoint")).toBe(true);
    expect(donutSource.includes("progressWidth")).toBe(true);
  });
});

describe("perception left panel", () => {
  test("exposes tabs for filters and brand summary", () => {
    expect(leftPanelSource.includes('value="filters"')).toBe(true);
    expect(leftPanelSource.includes('value="brand"')).toBe(true);
    expect(PERCEPTION_TEXT.leftPanel.tabs.filters).toBe("Filtres");
    expect(PERCEPTION_TEXT.leftPanel.tabs.brand).toBe("Marque");
  });

  test("exposes grouped and per-ai model filter modes", () => {
    expect(leftPanelSource.includes("PERCEPTION_TEXT.filters.groupedMode")).toBe(true);
    expect(leftPanelSource.includes("PERCEPTION_TEXT.filters.uniqueMode")).toBe(true);
  });
});
