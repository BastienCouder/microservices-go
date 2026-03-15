import { AnalyticsPanelLoading } from "./analytics-panel-loading";
import { AnalyticsPanelView } from "./analytics-panel-view";
import { useAnalyticsPanelViewModel } from "../../_lib/analytics/use-analytics-panel-view-model";

export function AnalyticsPanel() {
  const viewModel = useAnalyticsPanelViewModel();

  if (viewModel.loading) {
    return <AnalyticsPanelLoading />;
  }

  return <AnalyticsPanelView viewModel={viewModel} />;
}
