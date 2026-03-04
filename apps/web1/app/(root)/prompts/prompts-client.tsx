"use client";

import { PromptsResponsesWorkspace } from "./_components/prompts-workspace";
import { DashboardDataProvider, type DashboardData } from "@/hooks/use-dashboard-data";
import type { RuntimeMode } from "@/lib/runtime-mode";

type PromptsClientProps = {
  initialData: DashboardData;
  initialMode: RuntimeMode;
  initialProjectId: string | null;
};

export function PromptsClient({ initialData, initialMode, initialProjectId }: PromptsClientProps) {
  return (
    <DashboardDataProvider
      initialData={initialData}
      initialMode={initialMode}
      initialProjectId={initialProjectId}
    >
      <PromptsResponsesWorkspace />
    </DashboardDataProvider>
  );
}
