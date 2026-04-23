import type { MonitoringData, MonitoringPrompt } from "@/hooks/use-monitoring-data";

import { ActivityAlertDetailSheet } from "./activity-alert-detail-sheet";
import { ActivityPromptDetailSheet } from "./activity-prompt-detail-sheet";

type MonitoringAlert = MonitoringData["alerts"][number];

type ActivityDetailSheetsProps = {
  selectedAlert: MonitoringAlert | null;
  closeAlert: () => void;
  selectedPrompt: MonitoringPrompt | null;
  closePrompt: () => void;
  onViewPromptResponse: (prompt: MonitoringPrompt) => void;
};

export function ActivityDetailSheets({
  selectedAlert,
  closeAlert,
  selectedPrompt,
  closePrompt,
  onViewPromptResponse,
}: ActivityDetailSheetsProps) {
  return (
    <>
      <ActivityAlertDetailSheet selectedAlert={selectedAlert} onClose={closeAlert} />
      <ActivityPromptDetailSheet
        selectedPrompt={selectedPrompt}
        onClose={closePrompt}
        onViewResponse={onViewPromptResponse}
      />
    </>
  );
}
