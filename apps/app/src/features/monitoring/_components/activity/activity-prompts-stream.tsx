import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { MonitoringData } from "@/lib/monitoring-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { EmptyStateCard } from "../../../../components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";

export const PROMPTS_STREAM_BATCH_SIZE = 10;

export function getInitialVisiblePromptsCount(
  previewCount: number,
  totalCount: number,
): number {
  if (totalCount <= 0) return 0;

  const safePreviewCount = Math.max(
    1,
    Number.isFinite(previewCount) ? Math.floor(previewCount) : 1,
  );

  return Math.min(safePreviewCount, totalCount);
}

export function getNextVisiblePromptsCount({
  currentCount,
  totalCount,
  batchSize = PROMPTS_STREAM_BATCH_SIZE,
}: {
  currentCount: number;
  totalCount: number;
  batchSize?: number;
}): number {
  if (totalCount <= 0) return 0;

  const safeBatch = Math.max(1, batchSize);

  return Math.min(totalCount, currentCount + safeBatch);
}

type PromptItem = MonitoringData["recent_prompts"][number];

type ActivityPromptsStreamProps = {
  filteredPrompts: PromptItem[];
  previewCount: number;
  onSelectPrompt: (prompt: PromptItem) => void;
};

export const ActivityPromptsStream = memo(function ActivityPromptsStream({
  filteredPrompts,
  previewCount,
  onSelectPrompt,
}: ActivityPromptsStreamProps) {
  const content = useI18nScope("monitoring-activity-panel");
  const totalPrompts = filteredPrompts.length;

  const initialVisibleCount = useMemo(
    () => getInitialVisiblePromptsCount(previewCount, totalPrompts),
    [previewCount, totalPrompts],
  );

  const [extraLoadedCount, setExtraLoadedCount] = useState(0);

  const resetKeyRef = useRef({
    filteredPrompts,
    previewCount,
  });

  const isStaleState =
    resetKeyRef.current.filteredPrompts !== filteredPrompts ||
    resetKeyRef.current.previewCount !== previewCount;

  const effectiveExtraLoadedCount = isStaleState ? 0 : extraLoadedCount;

  const visibleCount = getNextVisiblePromptsCount({
    currentCount: initialVisibleCount,
    totalCount: totalPrompts,
    batchSize: effectiveExtraLoadedCount,
  });

  const visiblePrompts = useMemo(
    () => filteredPrompts.slice(0, visibleCount),
    [filteredPrompts, visibleCount],
  );

  const hasMorePrompts = visibleCount < totalPrompts;
  const observerRef = useRef<IntersectionObserver | null>(null);

  const handleLoadMore = useCallback(() => {
    if (isStaleState) {
      resetKeyRef.current = { filteredPrompts, previewCount };
      setExtraLoadedCount(10);
      return;
    }

    setExtraLoadedCount((current) => current + 10);
  }, [filteredPrompts, previewCount, isStaleState]);

  const loadMoreRef = useCallback(
    (node: HTMLDivElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;

      if (!node || !hasMorePrompts || typeof IntersectionObserver === "undefined") {
        return;
      }

      observerRef.current = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) {
            handleLoadMore();
          }
        },
        {
          rootMargin: "160px 0px",
        },
      );

      observerRef.current.observe(node);
    },
    [handleLoadMore, hasMorePrompts],
  );

  if (isStaleState) {
    resetKeyRef.current = { filteredPrompts, previewCount };
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold md:text-base">
          <SectionTitle>{content.promptsStream}</SectionTitle>
        </h4>
        <Badge
          variant="secondary"
          className="h-6 bg-primary/10 px-2 font-mono text-xs text-primary"
        >
          {totalPrompts}
        </Badge>
      </div>

      <div className="flex min-h-0 flex-1 flex-col space-y-3 pb-4">
        {totalPrompts === 0 ? (
          <EmptyStateCard
            label={content.noPromptsFound}
            className="h-[140px] text-sm"
          />
        ) : (
          visiblePrompts.map((prompt, index) => {
            const promptIconSrc = prompt.modelIconPath || null;
            const modelGroup =
              prompt.modelGroupName || prompt.modelDisplayName || prompt.modelId;
            const modelName = prompt.modelDisplayName || "";

            return (
              <button
                type="button"
                key={`${prompt.modelId}-${prompt.time}-${index}`}
                onClick={() => onSelectPrompt(prompt)}
                className="group w-full cursor-pointer rounded-md bg-background p-4 text-left transition-all hover:ring-2 hover:ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`${content.promptsStream}: ${modelGroup}`}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {promptIconSrc ? (
                      <div className="rounded-md border border-border/50 bg-white p-1">
                        <img
                          src={promptIconSrc}
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

                  <span className="font-mono text-xs text-muted-foreground">
                    {prompt.time}
                  </span>
                </div>

                <p className="mb-3 line-clamp-3 text-xs font-medium leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground md:text-sm">
                  &quot;{prompt.text}&quot;
                </p>

                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                  <div className="flex items-center gap-3">
                    {prompt.mention ? (
                      <span className="rounded-sm text-xs font-semibold text-emerald-600">
                        {content.mentioned}
                      </span>
                    ) : (
                      <span className="rounded-sm text-xs font-medium text-destructive">
                        {content.missed}
                      </span>
                    )}

                    {prompt.rank ? (
                      <>
                        <div className="h-[12px] w-[1px] bg-border" />
                        <span
                          className={cn(
                            "text-xs",
                            prompt.rank === 1
                              ? "font-bold text-primary"
                              : "text-muted-foreground",
                          )}
                        >
                          {prompt.rank === 1 ? content.rankTop : `#${prompt.rank}`}
                        </span>
                      </>
                    ) : null}
                  </div>

                  <div
                    className={cn(
                      "flex h-6 items-center rounded-sm px-2 text-xs font-bold",
                      prompt.score > 80
                        ? "bg-green-500/10 text-green-700"
                        : prompt.score > 50
                          ? "bg-amber-500/10 text-amber-700"
                          : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {prompt.score}
                  </div>
                </div>
              </button>
            );
          })
        )}

        {hasMorePrompts ? (
          <div ref={loadMoreRef}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full text-xs md:text-sm"
              onClick={handleLoadMore}
            >
              {content.showMore}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
});