"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SectionTitle } from "@/components/shared/section-title";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  formatPerceptionFixTypeLabel,
  formatPerceptionPriorityLabel,
  formatPerceptionStatusLabel,
} from "../_lib";

type OptimizeDraft = {
  id: string;
  priority: "high" | "medium" | "low";
  type: string;
  title: string;
  issue: string;
  generatedContent: string;
  status: "draft";
};

export function PerceptionOptimizeActions({
  drafts,
  persistError,
}: {
  drafts: OptimizeDraft[];
  persistError: string | null;
}) {
  const { locale, t } = useScopedI18n("perception");
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          <SectionTitle>{t("optimizeActionsTitle")}</SectionTitle>
        </CardTitle>
        <CardDescription>{t("optimizeActionsDescription")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {persistError ? (
          <div className="rounded-md border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-700">
            {persistError}
          </div>
        ) : null}
        {drafts.length === 0 ? (
          <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            {t("optimizeActionsEmpty")}
          </div>
        ) : (
          drafts.map((draft) => (
            <div key={draft.id} className="rounded-lg border p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="font-medium text-sm">{draft.title}</div>
                <Badge variant={draft.priority === "high" ? "destructive" : "secondary"}>
                  {formatPerceptionPriorityLabel(draft.priority, locale)}
                </Badge>
              </div>
              <div className="mb-2 text-xs text-muted-foreground">
                {formatPerceptionFixTypeLabel(draft.type, locale)} • {t("optimizeActionsStatusPrefix")}:{" "}
                {formatPerceptionStatusLabel(draft.status, locale)}
              </div>
              <p className="mb-2 text-sm">{draft.issue}</p>
              <div className="rounded-md bg-muted/50 p-2 text-sm">{draft.generatedContent}</div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
