"use client";

import { Progress } from "@/components/ui/progress";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { cn } from "@/shared/utils";

type PromptsPlanProgressProps = {
  promptPlanUsage: {
    usedPrompts: number;
    limit: number;
    progress: number;
  };
  className?: string;
  compact?: boolean;
};

export function PromptsPlanProgress({
  promptPlanUsage,
  className,
  compact = false,
}: PromptsPlanProgressProps) {
  const { t } = useScopedI18n("prompts-workspace");

  const isDanger = promptPlanUsage.progress >= 100;
  const isWarning = !isDanger && promptPlanUsage.progress >= 85;

  const indicatorClassName = isDanger
    ? "bg-destructive"
    : isWarning
      ? "bg-amber-500"
      : "bg-background/40";

  const usageClassName = isDanger
    ? "text-destructive"
    : isWarning
      ? "text-amber-500"
      : "text-background/80";

  return (
    <div className={cn(compact ? "w-full" : "w-full md:w-[460px] md:shrink-0", className)}>
      <div className={cn(compact ? "space-y-1.5" : "flex items-center gap-3")}>
        <Progress
          value={promptPlanUsage.progress}
          className={cn("flex-1 bg-background/20", compact ? "h-1.5" : "h-2")}
          indicatorClassName={indicatorClassName}
        />

        <div className={cn("shrink-0 text-xs font-medium", compact && "truncate", usageClassName)}>
          {t("planPromptUsage", {
            used: promptPlanUsage.usedPrompts,
            limit: promptPlanUsage.limit,
          })}
        </div>
      </div>
    </div>
  );
}