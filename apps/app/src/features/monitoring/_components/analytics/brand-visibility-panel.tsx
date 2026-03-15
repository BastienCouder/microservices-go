import { BrandVisibilityPanelView } from "./brand-visibility-panel-view";
import { useBrandVisibilityViewModel } from "../../_lib/analytics/use-brand-visibility-view-model";

export function BrandVisibilityPanel() {
  const viewModel = useBrandVisibilityViewModel();
  return <BrandVisibilityPanelView viewModel={viewModel} />;
}
