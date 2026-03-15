import type { MonitoringData } from "@/lib/monitoring-data";

import { ActivityAlerts } from "./activity-alerts";
import { ActivityPromptsStream } from "./activity-prompts-stream";

const ALERTS_PREVIEW_COUNT = 3;
const PROMPTS_PREVIEW_COUNT = 5;
type MonitoringAlert = MonitoringData["alerts"][number];
type MonitoringPrompt = MonitoringData["recent_prompts"][number];

type ActivityPanelViewProps = {
  filteredAlerts: MonitoringAlert[];
  filteredPrompts: MonitoringPrompt[];
  onSelectAlert: (alert: MonitoringAlert) => void;
  onSelectPrompt: (prompt: MonitoringPrompt) => void;
};

export function ActivityPanelView({
  filteredAlerts,
  filteredPrompts,
  onSelectAlert,
  onSelectPrompt,
}: ActivityPanelViewProps) {
  return (
    <div className="h-auto px-0 md:px-1 lg:h-full lg:overflow-y-auto">
      <div className="flex flex-col gap-6 pb-4">
        <ActivityAlerts
          filteredAlerts={filteredAlerts}
          previewCount={ALERTS_PREVIEW_COUNT}
          onSelectAlert={onSelectAlert}
        />

        <ActivityPromptsStream
          filteredPrompts={filteredPrompts}
          previewCount={PROMPTS_PREVIEW_COUNT}
          onSelectPrompt={onSelectPrompt}
        />
      </div>
    </div>
  );
}
