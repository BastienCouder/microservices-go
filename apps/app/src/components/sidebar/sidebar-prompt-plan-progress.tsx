"use client";

import { useQuery } from "@tanstack/react-query";
import { appQueryKeys } from "@/lib/query-keys";
import { PromptsPlanProgress } from "@/components/shared/prompts-plan-progress";
import { buildPromptPlanUsageSummary } from "@/features/prompts/_lib/prompt-plan";
import { loadPromptQuotaUsage } from "@/features/prompts/_lib/prompt-quota";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type SidebarPromptPlanProgressProps = {
  apiBaseURL: string;
  organizationId: string;
  projectId: string;
  collapsed: boolean;
};

export function SidebarPromptPlanProgress({
  apiBaseURL,
  organizationId,
  projectId,
  collapsed,
}: SidebarPromptPlanProgressProps) {
  const content = useI18nScope("sidebar");
  const canLoadQuota =
    apiBaseURL.trim() !== "" && organizationId.trim() !== "" && projectId.trim() !== "";
  const promptQuotaQuery = useQuery({
    queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, projectId || null),
    enabled: canLoadQuota,
    queryFn: ({ signal }) => loadPromptQuotaUsage(apiBaseURL, projectId, organizationId, { signal }),
  });

  if (collapsed) return null;

  if (!canLoadQuota) {
    return (
      <div className="mb-2 px-1">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-2 text-xs font-medium text-muted-foreground">
          {content.promptQuotaUnavailable}
        </div>
      </div>
    );
  }

  if (promptQuotaQuery.isFetching && !promptQuotaQuery.data) {
    return (
      <div className="mb-2 px-1">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-2 text-xs font-medium text-muted-foreground">
          {content.promptQuotaLoading}
        </div>
      </div>
    );
  }

  if (promptQuotaQuery.isError || !promptQuotaQuery.data?.hasQuota) {
    return (
      <div className="mb-2 px-1">
        <div className="rounded-lg border border-border/70 bg-muted/20 px-2 py-2 text-xs font-medium text-muted-foreground">
          {content.promptQuotaUnavailable}
        </div>
      </div>
    );
  }

  const promptPlanUsage = buildPromptPlanUsageSummary({
    limit: promptQuotaQuery.data.monthlyQuota,
    usedPrompts: promptQuotaQuery.data.usedPrompts,
  });

  return (
    <div className="mb-2 px-1">
      <PromptsPlanProgress
        promptPlanUsage={promptPlanUsage}
        compact
        className="rounded-lg border border-border/70 bg-muted/20 px-2 py-2"
      />
    </div>
  );
}
