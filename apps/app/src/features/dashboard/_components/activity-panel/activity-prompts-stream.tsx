"use client";

import { memo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/dashboard-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { DashboardSectionTitle } from "../dashboard-section-title";
import { FiltersEmptyStateCard } from "../filters-empty-state-card";

type PromptItem = DashboardData["recent_prompts"][number];
type ModelItem = DashboardData["models"][number];

type ActivityPromptsStreamProps = {
  filteredPrompts: PromptItem[];
  models: ModelItem[];
  previewCount: number;
  onSelectPrompt: (prompt: PromptItem) => void;
};

function getModelData(models: ModelItem[], modelName: string, modelFilterKey?: string) {
  if (modelFilterKey) {
    const exact = models.find((model) => model.id === modelFilterKey);
    if (exact) return exact;
  }
  let modelId = modelName.toLowerCase();
  if (modelId === "google") modelId = "gemini";
  return models.find((model) => model.id === modelId);
}

function iconSrcFromKey(iconKey?: string) {
  if (!iconKey) return null;
  return `/models/${iconKey}.svg`;
}

export const ActivityPromptsStream = memo(function ActivityPromptsStream({ filteredPrompts, models, previewCount, onSelectPrompt }: ActivityPromptsStreamProps) {
  const content = useI18nScope("dashboard-activity-panel");
  const [showAll, setShowAll] = useState(false);
  const visiblePrompts = showAll ? filteredPrompts : filteredPrompts.slice(0, previewCount);

  return (
    <div className="flex min-h-0 flex-1 flex-col space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h4 className="text-sm font-semibold md:text-base">
          <DashboardSectionTitle>{content.promptsStream}</DashboardSectionTitle>
        </h4>
        <Badge variant="secondary" className="h-6 bg-primary/10 px-2 font-mono text-xs text-primary">
          {filteredPrompts.length}
        </Badge>
      </div>
      <div className="flex min-h-0 flex-1 flex-col space-y-3 pb-4">
        {filteredPrompts.length === 0 ? (
          <FiltersEmptyStateCard label={content.noPromptsFound} className="h-[140px] text-sm" />
        ) : (
          visiblePrompts.map((prompt, index) => {
            const modelObj = getModelData(models, prompt.model, prompt.modelFilterKey);
            const promptIconSrc = iconSrcFromKey(prompt.modelIconKey) ?? modelObj?.icon ?? null;
            return (
              <button
                type="button"
                key={`${prompt.model}-${prompt.time}-${index}`}
                onClick={() => onSelectPrompt(prompt)}
                className="group w-full rounded-md bg-background p-4 text-left transition-all hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                aria-label={`${content.promptsStream}: ${prompt.model}`}
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {promptIconSrc ? (
                      <div className="rounded-md border border-border/50 bg-white p-1">
                        <img
                          src={promptIconSrc}
                          alt={modelObj?.name || prompt.model}
                          width={14}
                          height={14}
                          loading="lazy"
                          className="h-3.5 w-3.5 object-contain"
                        />
                      </div>
                    ) : null}
                    <p className="text-xs font-medium text-foreground md:text-sm">{prompt.model}</p>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">{prompt.time}</span>
                </div>

                <p className="mb-3 line-clamp-3 text-xs font-medium leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground md:text-sm">&quot;{prompt.text}&quot;</p>

                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                  <div className="flex items-center gap-3">
                    {prompt.mention ? (
                      <span className="rounded-sm text-xs font-semibold text-emerald-600">{content.mentioned}</span>
                    ) : (
                      <span className="rounded-sm text-xs font-medium text-destructive">{content.missed}</span>
                    )}
                    {prompt.rank ? (
                      <>
                        <div className="h-[12px] w-[1px] bg-border" />
                        <span className={cn("text-xs", prompt.rank === 1 ? "font-bold text-primary" : "text-muted-foreground")}>
                          {prompt.rank === 1 ? content.rankTop : `#${prompt.rank}`}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "flex h-6 items-center rounded-sm px-2 text-xs font-bold",
                      prompt.score > 80 ? "bg-green-500/10 text-green-700" : prompt.score > 50 ? "bg-amber-500/10 text-amber-700" : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {prompt.score}
                  </div>
                </div>
              </button>
            );
          })
        )}

        {filteredPrompts.length > previewCount ? (
          <Button variant="ghost" size="sm" className="w-full text-xs md:text-sm" onClick={() => setShowAll((value) => !value)}>
            {showAll ? content.showLess : content.showMore}
          </Button>
        ) : null}
      </div>
    </div>
  );
});
