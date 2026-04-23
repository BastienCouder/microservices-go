import { ActivityDetailSheets } from "./activity-detail-sheets";
import { ActivityPanelLoading } from "./activity-panel-loading";
import { ActivityPanelView } from "./activity-panel-view";
import { useActivityPanelViewModel } from "../../_lib/activity/use-activity-panel-view-model";
import type { MonitoringPrompt } from "@/hooks/use-monitoring-data";

function openPromptResponse(prompt: MonitoringPrompt) {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", "responses");
  params.set("focusPromptId", prompt.promptId);
  params.set("responseId", prompt.responseId);
  window.location.assign(`/prompts?${params.toString()}`);
}

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
        onViewPromptResponse={openPromptResponse}
      />
    </>
  );
}
