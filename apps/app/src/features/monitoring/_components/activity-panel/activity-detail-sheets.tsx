"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { Copy, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import type { DashboardData, DashboardPrompt } from "@/lib/dashboard-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type DashboardAlert = DashboardData["alerts"][number];

type ActivityDetailSheetsProps = {
  selectedAlert: DashboardAlert | null;
  setSelectedAlert: (value: DashboardAlert | null) => void;
  selectedPrompt: DashboardPrompt | null;
  setSelectedPrompt: (value: DashboardPrompt | null) => void;
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

function getSentimentMeta(value: DashboardPrompt["sentiment"], content: Record<string, string>) {
  if (value === "positive") {
    return {
      label: content.sentimentPositive || "Positif",
      toneClass: "text-emerald-700",
      badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    };
  }
  if (value === "negative") {
    return {
      label: content.sentimentNegative || "Négatif",
      toneClass: "text-rose-700",
      badgeClass: "border-rose-200 bg-rose-50 text-rose-700",
    };
  }
  return {
    label: content.sentimentNeutral || "Neutre",
    toneClass: "text-amber-700",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
  };
}

function getScoreToneClass(score: number) {
  if (score >= 80) return "text-primary";
  if (score >= 55) return "text-amber-700";
  return "text-rose-700";
}

function MetricLine({
  label,
  value,
  hint,
  valueClassName,
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="space-y-1 rounded-md bg-muted/18 px-4 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
        <p className={cn("text-base font-semibold tracking-tight text-foreground sm:text-lg", valueClassName)}>{value}</p>
      </div>
      {hint ? <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function DetailSection({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      {eyebrow ? <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{eyebrow}</p> : null}
      <div className="space-y-3">
        <h3 className="text-base font-semibold tracking-tight text-foreground">{title}</h3>
        {children}
      </div>
    </section>
  );
}

export const ActivityDetailSheets = memo(function ActivityDetailSheets({ selectedAlert, setSelectedAlert, selectedPrompt, setSelectedPrompt }: ActivityDetailSheetsProps) {
  const isMobile = useIsMobile();
  const content = useI18nScope("dashboard-activity-panel");
  const selectedPromptIconSrc = selectedPrompt?.modelIconPath || undefined;
  const selectedPromptModelGroup = selectedPrompt?.modelGroupName || selectedPrompt?.modelDisplayName || selectedPrompt?.modelId || "Modele";
  const selectedPromptModelName = selectedPrompt?.modelDisplayName || "";
  const noDataLabel = content.noDataAvailable;
  const notAvailableLabel = content.notAvailable;
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const selectedPromptSentiment = selectedPrompt ? getSentimentMeta(selectedPrompt.sentiment, content) : null;
  const selectedPromptCitationCount = selectedPrompt?.citedUrls.length ?? 0;

  useEffect(() => {
    setCopyState("idle");
  }, [selectedPrompt]);

  const handleCopyPrompt = useCallback(async () => {
    if (!selectedPrompt?.text || typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedPrompt.text);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
  }, [selectedPrompt]);

  return (
    <>
      <Sheet open={!!selectedAlert} onOpenChange={(open) => !open && setSelectedAlert(null)}>
        <SheetContent side="right" className="flex w-full flex-col border-l border-border/60 bg-background p-0 sm:w-[340px]">
          {selectedAlert ? (
            <>
              <SheetHeader className="border-b border-border/60 bg-card p-5">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="secondary" className="h-6 bg-primary/10 px-2 text-xs font-semibold text-primary">{content.alertInsight}</Badge>
                  <span className="text-xs text-muted-foreground">{getAlertTypeLabel(selectedAlert.prompts) || selectedAlert.time}</span>
                </div>
                <SheetTitle className="text-base font-semibold leading-snug">{selectedAlert.msg}</SheetTitle>
              </SheetHeader>

              <div className="flex-1 space-y-4 p-5">
                <div className="space-y-3 rounded-md border border-border/60 bg-card p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{content.triggerPrompt}</p>
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

              <div className="border-t border-border/60 bg-card p-4">
                <Button variant="outline" size="sm" className="w-full border-border/60 text-xs md:text-sm" onClick={() => setSelectedAlert(null)}>
                  {content.close}
                </Button>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {isMobile ? (
        <Drawer open={!!selectedPrompt} onOpenChange={(open) => !open && setSelectedPrompt(null)}>
          <DrawerContent className="h-[92vh] max-h-[92vh] gap-0 overflow-hidden bg-background p-0">
            {selectedPrompt ? (
              <PromptDetailContent
                content={content}
                copyState={copyState}
                handleCopyPrompt={handleCopyPrompt}
                noDataLabel={noDataLabel}
                notAvailableLabel={notAvailableLabel}
                selectedPrompt={selectedPrompt}
                selectedPromptCitationCount={selectedPromptCitationCount}
                selectedPromptIconSrc={selectedPromptIconSrc}
                selectedPromptModelGroup={selectedPromptModelGroup}
                selectedPromptModelName={selectedPromptModelName}
                selectedPromptSentiment={selectedPromptSentiment}
                headerClassName="px-5 pb-4 pt-2"
                bodyClassName="space-y-8 px-5 py-5"
                useNativeScroll
              />
            ) : null}
          </DrawerContent>
        </Drawer>
      ) : (
        <Sheet open={!!selectedPrompt} onOpenChange={(open) => !open && setSelectedPrompt(null)}>
          <SheetContent className="flex w-full flex-col gap-0 overflow-hidden border-l border-border/60 bg-background p-0 sm:max-w-[640px]">
            {selectedPrompt ? (
              <PromptDetailContent
                content={content}
                copyState={copyState}
                handleCopyPrompt={handleCopyPrompt}
                noDataLabel={noDataLabel}
                notAvailableLabel={notAvailableLabel}
                selectedPrompt={selectedPrompt}
                selectedPromptCitationCount={selectedPromptCitationCount}
                selectedPromptIconSrc={selectedPromptIconSrc}
                selectedPromptModelGroup={selectedPromptModelGroup}
                selectedPromptModelName={selectedPromptModelName}
                selectedPromptSentiment={selectedPromptSentiment}
                headerClassName="px-6 py-5"
                bodyClassName="space-y-10 px-6 py-6"
              />
            ) : null}
          </SheetContent>
        </Sheet>
      )}
    </>
  );
});

function PromptDetailContent({
  content,
  copyState,
  handleCopyPrompt,
  noDataLabel,
  notAvailableLabel,
  selectedPrompt,
  selectedPromptCitationCount,
  selectedPromptIconSrc,
  selectedPromptModelGroup,
  selectedPromptModelName,
  selectedPromptSentiment,
  headerClassName,
  bodyClassName,
  useNativeScroll,
}: {
  content: Record<string, string>;
  copyState: "idle" | "done" | "error";
  handleCopyPrompt: () => void | Promise<void>;
  noDataLabel: string;
  notAvailableLabel: string;
  selectedPrompt: DashboardPrompt;
  selectedPromptCitationCount: number;
  selectedPromptIconSrc?: string;
  selectedPromptModelGroup: string;
  selectedPromptModelName: string;
  selectedPromptSentiment: ReturnType<typeof getSentimentMeta> | null;
  headerClassName?: string;
  bodyClassName?: string;
  useNativeScroll?: boolean;
}) {
  const contentBody = (
    <div className={bodyClassName}>
      <DetailSection title={content.analysisSummary} eyebrow={content.responseWithHighlights}>
        <div className="grid gap-5 border-t border-border/50 pt-4 sm:grid-cols-2 sm:gap-6">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{content.model}</p>
            <p className="text-sm font-medium text-foreground">{selectedPromptModelGroup}</p>
            {selectedPromptModelName && selectedPromptModelName !== selectedPromptModelGroup ? (
              <p className="mt-1 text-xs text-muted-foreground">{selectedPromptModelName}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{content.persona}</p>
            <p className="text-sm font-medium text-foreground">{selectedPrompt.persona || notAvailableLabel}</p>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{content.competitors}</p>
            <p className="text-sm leading-6 text-foreground">
              {selectedPrompt.competitorsMentioned.length > 0
                ? selectedPrompt.competitorsMentioned.join(", ")
                : noDataLabel}
            </p>
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Lecture synthétique">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricLine
            label={content.visibility}
            value={`${selectedPrompt.score}%`}
            hint={selectedPrompt.score >= 80 ? "Présence forte dans la réponse" : selectedPrompt.score >= 55 ? "Présence correcte mais perfectible" : "Présence faible dans la réponse"}
            valueClassName={getScoreToneClass(selectedPrompt.score)}
          />
          <MetricLine
            label={content.mention}
            value={selectedPrompt.mention ? content.yes : content.no}
            hint={selectedPrompt.mention ? "La marque apparaît explicitement" : "La marque n'apparaît pas explicitement"}
            valueClassName={selectedPrompt.mention ? "text-emerald-700" : "text-muted-foreground"}
          />
          <MetricLine
            label={content.responseTone}
            value={selectedPromptSentiment?.label || notAvailableLabel}
            hint="Qualification globale du ton de la réponse"
            valueClassName={selectedPromptSentiment?.toneClass}
          />
          <MetricLine
            label={content.sourceCoverage}
            value={selectedPromptCitationCount > 0 ? `${selectedPromptCitationCount}` : "0"}
            hint={selectedPromptCitationCount > 0 ? "Sources détectées dans la réponse" : "Aucune source détectée"}
            valueClassName={selectedPromptCitationCount > 0 ? "text-primary" : "text-muted-foreground"}
          />
        </div>
      </DetailSection>

      <DetailSection title={content.pagesCited} eyebrow={content.factualAccuracyLabel}>
        {selectedPrompt.citedUrls.length > 0 ? (
          <div className="space-y-2 border-t border-border/50 pt-4">
            {selectedPrompt.citedUrls.map((url) => (
              <div
                key={url}
                className="flex items-start gap-3 rounded-2xl bg-muted/18 px-4 py-3"
              >
                <div className="mt-0.5 text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                </div>
                <span className="min-w-0 break-all text-sm leading-6 text-foreground/88">{url}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-muted/18 px-4 py-5 text-sm text-muted-foreground">
            {noDataLabel}
          </div>
        )}
      </DetailSection>
    </div>
  );

  return (
    <>
      <div className={cn("border-b border-border/60 bg-background", headerClassName)}>
        <div className="flex flex-col gap-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {selectedPromptIconSrc ? (
                <div className="rounded-md bg-muted/30 p-2">
                  <img
                    src={selectedPromptIconSrc}
                    alt={selectedPromptModelGroup}
                    width={28}
                    height={28}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-base font-semibold tracking-tight sm:text-lg">{selectedPromptModelGroup}</p>
                {selectedPromptModelName && selectedPromptModelName !== selectedPromptModelGroup ? (
                  <p className="truncate text-sm text-muted-foreground">{selectedPromptModelName}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">{selectedPrompt.time}</p>
              </div>
            </div>

            <Button size="sm" variant="outline" className="h-9 gap-2 border-border/60 bg-background px-3 text-xs sm:text-sm" onClick={() => void handleCopyPrompt()}>
              <Copy className="h-3.5 w-3.5" />
              {copyState === "done" ? content.promptCopied : copyState === "error" ? content.copyUnavailable : content.copyPrompt}
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="secondary"
              className={cn(
                "h-7 rounded-full border-0 px-3 text-[11px] font-semibold uppercase tracking-[0.08em]",
                selectedPrompt.mention
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-muted/50 text-muted-foreground",
              )}
            >
              {content.mention}: {selectedPrompt.mention ? content.yes : content.no}
            </Badge>
            {selectedPromptSentiment ? (
              <Badge
                variant="secondary"
                className={cn(
                  "h-7 rounded-full border-0 px-3 text-[11px] font-semibold uppercase tracking-[0.08em]",
                  selectedPromptSentiment.badgeClass.replace("border-emerald-200 ", "").replace("border-rose-200 ", "").replace("border-amber-200 ", ""),
                )}
              >
                {content.responseTone}: {selectedPromptSentiment.label}
              </Badge>
            ) : null}
            <Badge variant="secondary" className="h-7 rounded-full border-0 bg-muted/50 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              {content.citations}: {selectedPromptCitationCount}
            </Badge>
            {selectedPrompt.rank ? (
              <Badge variant="secondary" className="h-7 rounded-full border-0 bg-primary/10 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary">
                {content.rank}: #{selectedPrompt.rank}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {useNativeScroll ? (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {contentBody}
        </div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">
          {contentBody}
        </ScrollArea>
      )}
    </>
  );
}
