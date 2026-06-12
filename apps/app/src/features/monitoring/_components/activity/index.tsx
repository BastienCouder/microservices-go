import { Template } from "./template";
import { useActivityPanelViewModel } from "../../_lib/activity/use-activity-panel-view-model";
import type { MonitoringData } from "../../_lib/shared/monitoring-data";
import { ActivityAlerts } from "./activity-alerts";
import { ActivityPromptsStream } from "./activity-prompts-stream";
import { ActivityAlertDetailSheet } from "./activity-alert-detail-sheet";
import { ActivityPromptDetailSheet } from "./activity-prompt-detail-sheet";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { useNavigate } from "react-router-dom";

const ALERTS_PREVIEW_COUNT = 3;
const PROMPTS_PREVIEW_COUNT = 5;

export function ActivityPanel() {
  const viewModel = useActivityPanelViewModel();
  const { t } = useScopedI18n("monitoring-activity-panel");
  const navigate = useNavigate();

  function openPromptResponse(prompt: MonitoringData["recent_prompts"][number]) {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "responses");
    params.set("focusPromptId", prompt.promptId);
    params.set("responseId", prompt.responseId);
    navigate(`/prompts?${params.toString()}`);
  }

  if (viewModel.loading) {
    return <Template />;
  }

  return (
    <>
      <div className="h-auto px-0 md:px-1 lg:h-full lg:overflow-y-auto">
        <div className="flex flex-col gap-6 pb-4">
          {viewModel.canExport ? (
            <div className="flex flex-wrap items-center justify-end gap-2 lg:hidden">
              <Button
                size="sm"
                variant="outline"
                disabled={viewModel.exportDisabled}
                onClick={viewModel.handleExportMonitoringData}
              >
                <Download className="size-4" />
                {t("exportExcel")}
              </Button>
            </div>
          ) : null}

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
