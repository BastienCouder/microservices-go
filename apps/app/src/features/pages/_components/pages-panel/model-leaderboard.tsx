import { Bot } from "lucide-react";

import { SectionTitle } from "@/components/shared/section-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";

import type { ModelLeader } from "../../_lib/pages-panel/types";

export function ModelLeaderboard({ models }: { models: ModelLeader[] }) {
  return (
    <Card className="rounded-md border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          <SectionTitle>LLMs qui citent le plus</SectionTitle>
        </CardTitle>
        <CardDescription>
          Modèles qui réutilisent le plus souvent vos pages comme sources.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {models.length === 0 ? (
          <EmptyPanelState label="Aucun LLM ne cite encore une page du site." />
        ) : (
          <div className="space-y-3">
            {models.map((model) => (
              <div key={model.id} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-background">
                    {model.iconPath ? (
                      <img
                        src={toSafeImageAssetPath(model.iconPath)}
                        alt=""
                        width={18}
                        height={18}
                        loading="lazy"
                        decoding="async"
                        className="h-[18px] w-[18px] object-contain"
                      />
                    ) : (
                      <Bot className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold">{model.label}</span>
                      <span className="text-sm font-semibold tabular-nums">
                        {model.coverageShare}%
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {model.citedPageCount} pages • {model.sourcedPromptCount} réponses
                    </div>
                  </div>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.min(100, model.coverageShare)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function EmptyPanelState({ label }: { label: string }) {
  return (
    <div className="flex min-h-[150px] items-center justify-center rounded-md border border-dashed border-border/70 bg-muted/15 px-4 text-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}
