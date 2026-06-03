import { Template } from "./template";
import { useActivityPanelViewModel } from "../../_lib/activity/use-activity-panel-view-model";
import type { MonitoringData } from "../../_lib/shared/monitoring-data";
import { ActivityAlerts } from "./activity-alerts";
import { ActivityPromptsStream } from "./activity-prompts-stream";
import { ActivityAlertDetailSheet } from "./activity-alert-detail-sheet";
import { ActivityPromptDetailSheet } from "./activity-prompt-detail-sheet";

function openPromptResponse(prompt: MonitoringData["recent_prompts"][number]) {
  const params = new URLSearchParams(window.location.search);
  params.set("tab", "responses");
  params.set("focusPromptId", prompt.promptId);
  params.set("responseId", prompt.responseId);
  window.location.assign(`/prompts?${params.toString()}`);
}

const ALERTS_PREVIEW_COUNT = 3;
const PROMPTS_PREVIEW_COUNT = 5;

export function ActivityPanel() {
  const viewModel = useActivityPanelViewModel();

  if (viewModel.loading) {
    return <Template />;
  }

  return (
    <>
      <div className="h-auto px-0 md:px-1 lg:h-full lg:overflow-y-auto">
        <div className="flex flex-col gap-6 pb-4">
          <ActivityAlerts
            filteredAlerts={viewModel.filteredAlerts}
            previewCount={ALERTS_PREVIEW_COUNT}
            onSelectAlert={viewModel.selectAlert}
          />

          <ActivityPromptsStream
            filteredPrompts={viewModel.filteredPrompts}
            previewCount={PROMPTS_PREVIEW_COUNT}
            onSelectPrompt={viewModel.selectPrompt}
          />
        </div>
      </div>
      <ActivityAlertDetailSheet
        selectedAlert={viewModel.selectedAlert}
        onClose={viewModel.closeAlert}
      />
      <ActivityPromptDetailSheet
        selectedPrompt={viewModel.selectedPrompt}
        onClose={viewModel.closePrompt}
        onViewResponse={openPromptResponse}
      />
    </>
  );
}
