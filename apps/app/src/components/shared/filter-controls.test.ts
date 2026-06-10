import { describe, expect, test } from "bun:test";

const filterPopoverSource = await Bun.file(
  new URL("./multi-select-filter-popover.tsx", import.meta.url),
).text();
const periodFilterSource = await Bun.file(
  new URL("./period-filter-picker.tsx", import.meta.url),
).text();
const toolbarSource = await Bun.file(
  new URL("./responsive-filters-toolbar.tsx", import.meta.url),
).text();
const checklistSource = await Bun.file(
  new URL("./checklist-filter-section.tsx", import.meta.url),
).text();
const modelFilterModeTabsSource = await Bun.file(
  new URL("./model-filter-mode-tabs.tsx", import.meta.url),
).text();
const monitoringModelFilterSource = await Bun.file(
  new URL(
    "../../features/monitoring/_components/filters/model-filter-section.tsx",
    import.meta.url,
  ),
).text();
const perceptionLeftPanelSource = await Bun.file(
  new URL(
    "../../features/perception/_components/perception-left-panel.tsx",
    import.meta.url,
  ),
).text();
const monitoringCompetitorsSource = await Bun.file(
  new URL(
    "../../features/monitoring/_components/filters/competitor-filter-section.tsx",
    import.meta.url,
  ),
).text();
const monitoringPersonasSource = await Bun.file(
  new URL(
    "../../features/monitoring/_components/filters/persona-filter-section.tsx",
    import.meta.url,
  ),
).text();
const promptsToolbarSource = await Bun.file(
  new URL(
    "../../features/prompts/_components/filters/prompts-filters-toolbar.tsx",
    import.meta.url,
  ),
).text();
const promptModelsSource = await Bun.file(
  new URL(
    "../../features/prompts/_components/filters/models-filter-popover.tsx",
    import.meta.url,
  ),
).text();
const promptCompetitorsSource = await Bun.file(
  new URL(
    "../../features/prompts/_components/filters/competitors-filter-popover.tsx",
    import.meta.url,
  ),
).text();
const pagesPanelSource = await Bun.file(
  new URL(
    "../../features/pages/_components/pages-panel/index.tsx",
    import.meta.url,
  ),
).text();
const errorHubToolbarSource = await Bun.file(
  new URL(
    "../../features/error-hub/_components/error-hub-filters-toolbar.tsx",
    import.meta.url,
  ),
).text();
const errorHubModelsSource = await Bun.file(
  new URL(
    "../../features/error-hub/_components/filters/error-hub-models-filter.tsx",
    import.meta.url,
  ),
).text();
const errorHubCompetitorsSource = await Bun.file(
  new URL(
    "../../features/error-hub/_components/filters/error-hub-competitors-filter.tsx",
    import.meta.url,
  ),
).text();
const crawlerResultsSource = await Bun.file(
  new URL(
    "../../features/crawler/_components/crawl-panel/_components/crawler-results-view.tsx",
    import.meta.url,
  ),
).text();
const trafficReportSource = await Bun.file(
  new URL(
    "../../features/traffic/_components/report/index.tsx",
    import.meta.url,
  ),
).text();
const trafficEngineFilterSource = await Bun.file(
  new URL(
    "../../features/traffic/_components/report/traffic-engine-filter.tsx",
    import.meta.url,
  ),
).text();

describe("shared filter controls", () => {
  test("centralizes popover selection controls for models and competitors", () => {
    expect(filterPopoverSource.includes("export type MultiSelectFilterOption")).toBe(true);
    expect(filterPopoverSource.includes("export function MultiSelectFilterPopover")).toBe(true);
    expect(promptModelsSource.includes("MultiSelectFilterPopover")).toBe(true);
    expect(promptCompetitorsSource.includes("MultiSelectFilterPopover")).toBe(true);
    expect(pagesPanelSource.includes("MultiSelectFilterPopover")).toBe(true);
    expect(errorHubModelsSource.includes("MultiSelectFilterPopover")).toBe(true);
    expect(errorHubCompetitorsSource.includes("MultiSelectFilterPopover")).toBe(true);
  });

  test("keeps model competitor and period filter headers without subtitles", () => {
    expect(filterPopoverSource.includes("FloatingPanelHeader title={title} description=")).toBe(false);
    expect(periodFilterSource.includes("description?:")).toBe(false);
    expect(periodFilterSource.includes("description ?? content.chooseRange")).toBe(false);
    expect(errorHubToolbarSource.includes("description=")).toBe(false);
    expect(crawlerResultsSource.includes("description=")).toBe(false);
    expect(trafficReportSource.includes("description=")).toBe(false);
    expect(trafficEngineFilterSource.includes("description=")).toBe(false);
  });

  test("centralizes responsive filter toolbar disclosure", () => {
    expect(toolbarSource.includes("export function ResponsiveFiltersToolbar")).toBe(true);
    expect(promptsToolbarSource.includes("ResponsiveFiltersToolbar")).toBe(true);
    expect(errorHubToolbarSource.includes("ResponsiveFiltersToolbar")).toBe(true);
    expect(promptsToolbarSource.includes("CollapsibleTrigger")).toBe(false);
    expect(errorHubToolbarSource.includes("CollapsibleTrigger")).toBe(false);
  });

  test("centralizes monitoring checklist filter rows", () => {
    expect(checklistSource.includes("export type ChecklistFilterOption")).toBe(true);
    expect(checklistSource.includes("export function ChecklistFilterSection")).toBe(true);
    expect(monitoringCompetitorsSource.includes("ChecklistFilterSection")).toBe(true);
    expect(monitoringPersonasSource.includes("ChecklistFilterSection")).toBe(true);
    expect(monitoringCompetitorsSource.includes("<Checkbox")).toBe(false);
    expect(monitoringPersonasSource.includes("<Checkbox")).toBe(false);
  });

  test("centralizes boolean model filter mode tabs", () => {
    expect(modelFilterModeTabsSource.includes("export function BooleanModelFilterModeTabs")).toBe(true);
    expect(monitoringModelFilterSource.includes("BooleanModelFilterModeTabs")).toBe(true);
    expect(perceptionLeftPanelSource.includes("BooleanModelFilterModeTabs")).toBe(true);
    expect(monitoringModelFilterSource.includes("value={showUniqueModelFilters ?")).toBe(false);
    expect(perceptionLeftPanelSource.includes("value={showUniqueModelFilters ?")).toBe(false);
    expect(perceptionLeftPanelSource.includes("groupedLabel=")).toBe(false);
    expect(perceptionLeftPanelSource.includes("uniqueLabel=")).toBe(false);
  });
});
