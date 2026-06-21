import { memo, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { cn } from "@/lib/utils";
import { resolveProjectModelIconPath } from "@/lib/project-models";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  averagePerceptionResponseScore,
  formatPerceptionResponseTime,
  getWeakestPerceptionAxis,
} from "../_lib/perception-response-format";
import type {
  PerceptionModelOption,
  PerceptionResponseRecord,
} from "../_lib/shared/perception-data";

type PerceptionPromptsStreamProps = {
  responses: PerceptionResponseRecord[];
  modelCatalog: PerceptionModelOption[];
  previewCount?: number;
  running?: boolean;
  onViewMore: () => void;
  onSelectResponse: (response: PerceptionResponseRecord) => void;
};

function scoreClassName(score: number) {
  if (score > 80) return "bg-green-500/10 text-green-700";
  if (score > 50) return "bg-amber-500/10 text-amber-700";
  return "bg-destructive/10 text-destructive";
}

function PerceptionPromptStreamSkeletonCard() {
  return (
    <div className="w-full rounded-md bg-background p-4 text-left">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Skeleton className="h-6 w-6 rounded-md" />
          <div className="min-w-0 space-y-1.5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-3 w-10" />
      </div>

      <div className="mb-3 space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/3" />
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-3">
        <div className="flex min-w-0 items-center gap-3">
          <Skeleton className="h-4 w-14" />
          <div className="h-[12px] w-[1px] bg-border" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-6 w-12 rounded-sm" />
      </div>
    </div>
  );
}

export const PerceptionPromptsStream = memo(function PerceptionPromptsStream({
  responses,
  modelCatalog,
  previewCount = 6,
  running = false,
  onViewMore,
  onSelectResponse,
}: PerceptionPromptsStreamProps) {
  const { locale, t } = useScopedI18n("perception");
  const modelByKey = useMemo(() => {
    const entries = new Map<string, PerceptionModelOption>();
    for (const model of modelCatalog) {
      for (const key of [model.id, model.displayName, model.groupName, model.providerModelId]) {
        if (key.trim()) entries.set(key.trim(), model);
      }
    }
    return entries;
  }, [modelCatalog]);

  const sortedResponses = useMemo(
    () =>
      [...responses].sort((left, right) => {
        const leftTime = left.createdAt ? new Date(left.createdAt).getTime() : 0;
        const rightTime = right.createdAt ? new Date(right.createdAt).getTime() : 0;
        return rightTime - leftTime;
      }),
    [responses],
  );
  const visibleResponses = sortedResponses.slice(0, previewCount);
  const totalResponses = sortedResponses.length;

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold md:text-base">
          <SectionTitle>{t("responsesStreamTitle")}</SectionTitle>
        </h4>
        <Badge
          variant="secondary"
          className="h-6 bg-primary/10 px-2 font-mono text-xs text-primary"
        >
          {totalResponses}
        </Badge>
      </div>

      <div className="flex min-h-0 flex-1 flex-col space-y-3 pb-4">
        {running ? <PerceptionPromptStreamSkeletonCard /> : null}

        {totalResponses === 0 && !running ? (
          <EmptyStateCard
            label={t("responsesStreamEmpty")}
            className="h-[140px] text-sm"
          />
        ) : (
          visibleResponses.map((response, index) => {
            const modelMeta = modelByKey.get(response.modelId) || modelByKey.get(response.modelName);
            const modelGroup =
              response.modelGroupName ||
              modelMeta?.groupName ||
              response.modelName ||
              response.modelId;
            const modelName =
              response.modelName ||
              modelMeta?.displayName ||
              modelMeta?.providerModelId ||
              "";
            const iconSrc = modelMeta ? resolveProjectModelIconPath(modelMeta) : "";
            const score = averagePerceptionResponseScore(response);
            const weakestAxis = getWeakestPerceptionAxis(response);

            return (
              <button
                type="button"
                key={response.id || `${response.promptRunId}-${response.modelId}-${index}`}
                onClick={() => onSelectResponse(response)}
                className="group w-full cursor-pointer rounded-md bg-background p-4 text-left transition-all hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`${t("responsesStreamTitle")}: ${modelGroup}`}
              >
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    {iconSrc ? (
                      <div className="rounded-md border border-border/50 bg-white p-1">
                        <img
                          src={iconSrc}
                          alt={modelName || modelGroup}
                          width={14}
                          height={14}
                          loading="lazy"
                          decoding="async"
                          className="h-3.5 w-3.5 object-contain"
                        />
                      </div>
                    ) : null}

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold capitalize text-foreground md:text-sm">
                        {modelGroup}
                      </p>
                      {modelName && modelName !== modelGroup ? (
                        <p className="truncate text-[11px] lowercase text-muted-foreground md:text-xs">
                          {modelName}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {formatPerceptionResponseTime(response.createdAt, locale)}
                  </span>
                </div>

                <p className="mb-3 line-clamp-3 text-xs font-medium leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground md:text-sm">
                  &quot;{response.promptText || response.rawResponse || "-"}&quot;
                </p>

                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span
                      className={cn(
                        "rounded-sm text-xs font-semibold",
                        response.sentiment === "positive"
                          ? "text-emerald-600"
                          : response.sentiment === "negative"
                            ? "text-destructive"
                            : "text-amber-700",
                      )}
                    >
                      {t(`responsesStreamSentiment_${response.sentiment}`)}
                    </span>

                    <div className="h-[12px] w-[1px] bg-border" />
                    <span className="truncate text-xs text-muted-foreground">
                      {t("responsesStreamWeakAxis", {
                        axis: t(`responsesAxis_${weakestAxis.axis}`),
                      })}
                    </span>
                  </div>

                  <div
                    className={cn(
                      "flex h-6 items-center rounded-sm px-2 text-xs font-bold",
                      scoreClassName(score),
                    )}
                  >
                    {score}/100
                  </div>
                </div>
              </button>
            );
          })
        )}

        {totalResponses > 0 ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs md:text-sm"
            onClick={onViewMore}
          >
            {t("responsesStreamViewMore")}
          </Button>
        ) : null}
      </div>
    </div>
  );
});
