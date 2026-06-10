"use client";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/shared/section-title";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  formatPerceptionFixTypeLabel,
  formatPerceptionPriorityLabel,
  formatPerceptionStatusLabel,
  getPerceptionActionStatusTone,
  getPerceptionPriorityTone,
} from "../_lib";

type OptimizeDraft = {
  id: string;
  priority: "high" | "medium" | "low";
  type: string;
  title: string;
  issue: string;
  generatedContent: string;
  status: string;
};

export function PerceptionOptimizeActions({
  drafts,
  emptyLabel,
  persistError,
}: {
  drafts: OptimizeDraft[];
  emptyLabel?: string | null;
  persistError: string | null;
}) {
  const { locale, t } = useScopedI18n("perception");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          <SectionTitle>{t("optimizeActionsTitle")}</SectionTitle>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {drafts.length === 0 ? (
          <EmptyStateCard label={emptyLabel || t("optimizeActionsEmpty")} className="h-[120px] text-sm" />
        ) : (
          drafts.map((draft) => (
            <div key={draft.id} className="rounded-xl border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{draft.title}</div>
                <Badge variant="outline" className={cn("shrink-0", getPerceptionPriorityTone(draft.priority))}>
                  {formatPerceptionPriorityLabel(draft.priority, locale)}
                </Badge>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span>{formatPerceptionFixTypeLabel(draft.type, locale)}</span>
                <Badge variant="outline" className={cn("h-6 rounded-sm px-2 text-xs font-bold", getPerceptionActionStatusTone(draft.status))}>
                  {t("optimizeActionsStatusPrefix")}: {formatPerceptionStatusLabel(draft.status, locale)}
                </Badge>
              </div>
              <p className="mb-2 text-sm">{draft.issue}</p>
              <div className="rounded-lg bg-muted/50 p-2 text-sm">{draft.generatedContent}</div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
