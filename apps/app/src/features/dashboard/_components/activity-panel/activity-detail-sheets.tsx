"use client";

import { memo } from "react";
import { AlertTriangle, Copy, MessageSquare, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type { DashboardData, DashboardPrompt } from "@/lib/dashboard-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type DashboardAlert = DashboardData["alerts"][number];
type DashboardModel = DashboardData["models"][number];

type ActivityDetailSheetsProps = {
  selectedAlert: DashboardAlert | null;
  setSelectedAlert: (value: DashboardAlert | null) => void;
  selectedPrompt: DashboardPrompt | null;
  setSelectedPrompt: (value: DashboardPrompt | null) => void;
  getModelData: (modelName: string, modelFilterKey?: string) => DashboardModel | undefined;
};

function getAlertTypeLabel(value?: string) {
  const key = (value || "").trim().toLowerCase();
  if (!key) return "";
  const map: Record<string, string> = {
    visibility_drop: "Baisse de visibilite",
    competitor_surge: "Concurrence en hausse",
    ranking_loss: "Perte de position",
    sentiment_drop: "Baisse de sentiment",
    factual_error_spike: "Hausse des erreurs factuelles",
    mention_drop: "Baisse des mentions",
    citation_drop: "Baisse des citations",
    pricing_mismatch: "Decalage pricing",
  };
  return map[key] || key.replace(/_/g, " ");
}

export const ActivityDetailSheets = memo(function ActivityDetailSheets({ selectedAlert, setSelectedAlert, selectedPrompt, setSelectedPrompt, getModelData }: ActivityDetailSheetsProps) {
  const content = useI18nScope("dashboard-activity-panel");
  const selectedPromptIconSrc = selectedPrompt?.modelIconKey ? `/models/${selectedPrompt.modelIconKey}.svg` : undefined;
  const noDataLabel = content.noDataAvailable;
  const notAvailableLabel = content.notAvailable;

  return (
    <>
      <Sheet open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <SheetContent side="right" className="flex w-[340px] flex-col border-l border-border/60 bg-background p-0">
          {selectedAlert ? (
            <>
              <SheetHeader className="border-b border-border/60 bg-card p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary" className="h-5 bg-primary/10 px-2 text-[10px] font-semibold text-primary">{content.alertInsight}</Badge>
                  <span className="text-[10px] text-muted-foreground">{getAlertTypeLabel(selectedAlert.prompts) || selectedAlert.time}</span>
                </div>
                <SheetTitle className="text-base font-semibold leading-snug">{selectedAlert.msg}</SheetTitle>
              </SheetHeader>

              <div className="flex-1 space-y-4 p-5">
                <div className="space-y-3 rounded-md border border-border/60 bg-card p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{content.triggerPrompt}</p>
                  <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-[12px] italic leading-relaxed text-foreground/80">
                    {selectedAlert.prompts || noDataLabel}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground">{content.score}</p>
                    <p className="mt-1 font-mono text-sm font-bold text-primary">{notAvailableLabel}</p>
                  </div>
                  <div className="rounded-md border border-border/60 bg-card p-3">
                    <p className="text-[9px] font-bold uppercase text-muted-foreground">{content.mentions}</p>
                    <p className="mt-1 text-sm font-bold">{notAvailableLabel}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 border-t border-border/60 bg-card p-4">
                <Button variant="outline" size="sm" className="border-border/60 text-xs" onClick={() => setSelectedAlert(null)}>
                  {content.ignore}
                </Button>
                <Button size="sm" className="gap-1.5 text-xs">
                  <Zap className="h-3 w-3" />
                  {content.optimize}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedPrompt} onOpenChange={(open) => !open && setSelectedPrompt(null)}>
        <SheetContent className="flex flex-col border-l border-border/60 bg-background p-0 sm:max-w-[520px]">
          {selectedPrompt ? (
            <>
              <SheetHeader className="border-b border-border/60 bg-card p-6">
                <div className="mb-2 flex items-center gap-2">
                  {(selectedPromptIconSrc || getModelData(selectedPrompt.model, selectedPrompt.modelFilterKey)?.icon) ? (
                    <div className="rounded-md border border-border/50 bg-white p-1">
                      <img
                        src={selectedPromptIconSrc || getModelData(selectedPrompt.model, selectedPrompt.modelFilterKey)!.icon}
                        alt={selectedPrompt.model}
                        width={24}
                        height={24}
                        loading="lazy"
                      />
                    </div>
                  ) : null}
                  <p className="text-sm font-semibold">{selectedPrompt.model}</p>
                  <span className="text-[10px] text-muted-foreground">{selectedPrompt.time}</span>
                </div>
                <SheetTitle className="text-lg font-semibold tracking-tight">{content.detailedAnalysis}</SheetTitle>
                <div className="flex gap-2 pt-4">
                  <Button size="sm" className="h-8 gap-1.5">
                    <Zap className="h-3.5 w-3.5" /> {content.createOptimizeAction}
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 border-border/60">
                    <Copy className="h-3.5 w-3.5" /> {content.copyPrompt}
                  </Button>
                </div>
              </SheetHeader>

              <ScrollArea className="flex-1">
                <div className="space-y-4 p-6">
                  <div className="space-y-3 rounded-md border border-border/60 bg-card p-4">
                    <h5 className="flex items-center gap-2 text-[11px] font-bold uppercase text-muted-foreground">
                      <MessageSquare className="h-3.5 w-3.5 text-primary" /> {content.userPrompt}
                    </h5>
                    <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-sm font-medium italic leading-relaxed">
                      &quot;{selectedPrompt.text}&quot;
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border border-border/60 bg-card p-4">
                    <h5 className="text-[11px] font-bold uppercase text-muted-foreground">{content.responseWithHighlights}</h5>
                    <div className="space-y-3 rounded-md border border-border/50 bg-background p-3 text-sm leading-relaxed">
                      <p className="text-xs text-muted-foreground">
                        {content.competitors}:{" "}
                        {selectedPrompt.competitorsMentioned.length > 0
                          ? selectedPrompt.competitorsMentioned.join(", ")
                          : noDataLabel}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {content.rank}: {selectedPrompt.rank ? `#${selectedPrompt.rank}` : notAvailableLabel}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-border/60 bg-card p-3">
                      <p className="mb-1 text-[9px] font-bold uppercase text-muted-foreground">{content.visibility}</p>
                      <p className="text-xl font-bold text-foreground">{selectedPrompt.score}%</p>
                    </div>
                    <div className="rounded-md border border-border/60 bg-card p-3">
                      <p className="mb-1 text-[9px] font-bold uppercase text-muted-foreground">{content.mention}</p>
                      <p className={cn("text-sm font-bold", selectedPrompt.mention ? "text-emerald-600" : "text-muted-foreground")}>{selectedPrompt.mention ? content.yes : content.no}</p>
                    </div>
                  </div>

                  <div className="space-y-3 rounded-md border border-border/60 bg-card p-4">
                    <div className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/40 p-3">
                      <input type="checkbox" id="reviewed" className="h-4 w-4 rounded border-gray-300 accent-primary" />
                      <label htmlFor="reviewed" className="cursor-pointer text-sm font-semibold">{content.markAsReviewed}</label>
                    </div>
                    <Button variant="outline" className="w-full justify-start gap-2 border-dashed border-border/60 hover:border-primary hover:bg-primary/5">
                      <AlertTriangle className="h-4 w-4 text-primary" /> {content.createCorrectionTask}
                    </Button>
                  </div>
                </div>
              </ScrollArea>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
});
