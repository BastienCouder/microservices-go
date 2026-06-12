import { Bot } from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { SectionTitle } from "@/components/shared/section-title";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

import type { ModelLeader } from "../../_lib/pages-panel/types";

type ModelLeaderboardProps = {
  errorLabel?: string | null;
  models: ModelLeader[];
  loading?: boolean;
};

export function ModelLeaderboard({ errorLabel, models, loading = false }: ModelLeaderboardProps) {
  const { t } = useScopedI18n("pages");
  return (
    <Card className="rounded-md border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          <SectionTitle>{t("modelLeaderboardTitle")}</SectionTitle>
        </CardTitle>
        <CardDescription>{t("modelLeaderboardDescription")}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="space-y-2">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-9 w-9 shrink-0 rounded-md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-4 w-10" />
                    </div>
                    <Skeleton className="mt-2 h-3 w-36" />
                  </div>
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        ) : models.length === 0 ? (
          <EmptyStateCard
            label={errorLabel || t("noLlmYet")}
            className="h-[150px]"
          />
        ) : (
          <div className="space-y-3">
            {models.map((model) => (
              <div key={model.id} className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border bg-background">
                    {toSafeImageAssetPath(model.iconPath) ? (
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
                      {model.citedPageCount} {t("pagesWord")} • {model.sourcedPromptCount} {t("responses")}
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
