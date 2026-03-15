import { ActivityDetailSheets } from "./activity-detail-sheets";
import { ActivityPanelLoading } from "./activity-panel-loading";
import { ActivityPanelView } from "./activity-panel-view";
import { useActivityPanelViewModel } from "../../_lib/activity/use-activity-panel-view-model";

export function ActivityPanel() {
  const viewModel = useActivityPanelViewModel();

  if (viewModel.loading) {
    return <ActivityPanelLoading />;
  }

  return (
    <>
      <ActivityPanelView
        filteredAlerts={viewModel.filteredAlerts}
        filteredPrompts={viewModel.filteredPrompts}
        onSelectAlert={viewModel.selectAlert}
        onSelectPrompt={viewModel.selectPrompt}
      />
      <ActivityDetailSheets
        selectedAlert={viewModel.selectedAlert}
        closeAlert={viewModel.closeAlert}
        selectedPrompt={viewModel.selectedPrompt}
        closePrompt={viewModel.closePrompt}
      />
    </>
  );
}
