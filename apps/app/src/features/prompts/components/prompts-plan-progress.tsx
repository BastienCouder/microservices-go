"use client";

import { Progress } from "@/components/ui/progress";
import type { PromptPlanUsageSummary } from "@/features/prompts/_lib/prompt-plan";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { cn } from "@/shared/utils";

type PromptsPlanProgressProps = {
  promptPlanUsage: PromptPlanUsageSummary;
  className?: string;
};

export function PromptsPlanProgress({
  promptPlanUsage,
  className,
}: PromptsPlanProgressProps) {
  const { t } = useScopedI18n("prompts-workspace");
  const isDanger = promptPlanUsage.progress >= 100;
  const isWarning = !isDanger && promptPlanUsage.progress >= 85;
  const indicatorClassName = isDanger
    ? "bg-destructive"
    : isWarning
      ? "bg-amber-500"
      : undefined;
  const usageClassName = isDanger
    ? "text-destructive"
    : isWarning
      ? "text-amber-600"
      : "text-muted-foreground";

  return (
    <div className={cn("w-full md:w-[460px] md:shrink-0", className)}>
      <div className="flex items-center gap-3">
        <Progress
          value={promptPlanUsage.progress}
          className="h-2 flex-1"
          indicatorClassName={indicatorClassName}
        />
        <div className={cn("shrink-0 text-xs font-medium", usageClassName)}>
          {t("planPromptUsage", {
            used: promptPlanUsage.usedPrompts,
            limit: promptPlanUsage.limit,
          })}
        </div>
      </div>
    </div>
  );
}
