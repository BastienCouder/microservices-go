import { FiltersPanelView } from "./filters-panel-view";
import { useFiltersPanelViewModel } from "../../_lib/filters/use-filters-panel-view-model";

export function FiltersPanel() {
  const viewModel = useFiltersPanelViewModel();
  return <FiltersPanelView {...viewModel} />;
}
