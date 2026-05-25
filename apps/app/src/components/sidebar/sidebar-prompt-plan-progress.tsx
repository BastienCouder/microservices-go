"use client";

import { ReactNode } from "react";
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

const wrapperClassName = "mb-2 px-1";

const cardClassName = "rounded-lg px-2 py-2";

const statusClassName = `${cardClassName} text-xs font-medium text-background`;

const progressClassName = `${cardClassName}`;

function SidebarPromptPlanStatus({ children }: { children: ReactNode }) {
  return (
    <div className={wrapperClassName}>
      <div className={statusClassName}>{children}</div>
    </div>
  );
}

export function SidebarPromptPlanProgress({
  apiBaseURL,
  organizationId,
  projectId,
  collapsed,
}: SidebarPromptPlanProgressProps) {
  const content = useI18nScope("sidebar");

  const canLoadQuota =
    apiBaseURL.trim() !== "" &&
    organizationId.trim() !== "" &&
    projectId.trim() !== "";

  const promptQuotaQuery = useQuery({
    queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, projectId || null),
    enabled: canLoadQuota,
    queryFn: ({ signal }) =>
      loadPromptQuotaUsage(apiBaseURL, projectId, organizationId, { signal }),
  });

  if (collapsed) return null;

  const data = promptQuotaQuery.data;

  if (!canLoadQuota) {
    return (
      <SidebarPromptPlanStatus>
        {content.promptQuotaUnavailable}
      </SidebarPromptPlanStatus>
    );
  }

  if (promptQuotaQuery.isFetching && !data) {
    return (
      <SidebarPromptPlanStatus>
        {content.promptQuotaLoading}
      </SidebarPromptPlanStatus>
    );
  }

  if (promptQuotaQuery.isError || !data?.hasQuota || !data) {
    return (
      <SidebarPromptPlanStatus>
        {content.promptQuotaUnavailable}
      </SidebarPromptPlanStatus>
    );
  }

  const promptPlanUsage = buildPromptPlanUsageSummary({
    limit: data.monthlyQuota,
    usedPrompts: data.usedPrompts,
  });

  return (
    <div className={wrapperClassName}>
      <PromptsPlanProgress
        promptPlanUsage={promptPlanUsage}
        compact
        className={progressClassName}
      />
    </div>
  );
}