import { Copy, Link2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { MonitoringPrompt } from "@/hooks/use-monitoring-data";
import { cn } from "@/lib/utils";

import {
  getScoreToneClass,
  getSentimentMeta,
} from "../../_lib/activity/activity-detail-helpers";
import { DetailSection, MetricLine } from "./activity-detail-primitives";

type ActivityPromptDetailContentProps = {
  content: Record<string, string>;
  copyState: "idle" | "done" | "error";
  handleCopyPrompt: () => void | Promise<void>;
  selectedPrompt: MonitoringPrompt;
  headerClassName?: string;
  bodyClassName?: string;
  useNativeScroll?: boolean;
};

export function ActivityPromptDetailContent({
  content,
  copyState,
  handleCopyPrompt,
  selectedPrompt,
  headerClassName,
  bodyClassName,
  useNativeScroll,
}: ActivityPromptDetailContentProps) {
  const selectedPromptIconSrc = selectedPrompt.modelIconPath || undefined;
  const selectedPromptModelGroup =
    selectedPrompt.modelGroupName ||
    selectedPrompt.modelDisplayName ||
    selectedPrompt.modelId ||
    "Modele";
  const selectedPromptModelName = selectedPrompt.modelDisplayName || "";
  const selectedPromptSentiment = getSentimentMeta(selectedPrompt.sentiment, content);
  const citationCount = selectedPrompt.citedUrls.length;
  const noDataLabel = content.noDataAvailable;
  const notAvailableLabel = content.notAvailable;

  const contentBody = (
    <div className={bodyClassName}>
      <DetailSection title={content.analysisSummary} eyebrow={content.responseWithHighlights}>
        <div className="grid gap-5 border-t border-border/50 pt-4 sm:grid-cols-2 sm:gap-6">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {content.model}
            </p>
            <p className="text-sm font-medium text-foreground">{selectedPromptModelGroup}</p>
            {selectedPromptModelName && selectedPromptModelName !== selectedPromptModelGroup ? (
              <p className="mt-1 text-xs text-muted-foreground">{selectedPromptModelName}</p>
            ) : null}
          </div>

          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {content.persona}
            </p>
            <p className="text-sm font-medium text-foreground">
              {selectedPrompt.persona || notAvailableLabel}
            </p>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {content.competitors}
            </p>
            <p className="text-sm leading-6 text-foreground">
              {selectedPrompt.competitorsMentioned.length > 0
                ? selectedPrompt.competitorsMentioned.join(", ")
                : noDataLabel}
            </p>
          </div>
        </div>
      </DetailSection>

      <DetailSection title="Lecture synthetique">
        <div className="grid gap-3 sm:grid-cols-2">
          <MetricLine
            label={content.visibility}
            value={`${selectedPrompt.score}%`}
            hint={
              selectedPrompt.score >= 80
                ? "Presence forte dans la reponse"
                : selectedPrompt.score >= 55
                  ? "Presence correcte mais perfectible"
                  : "Presence faible dans la reponse"
            }
            valueClassName={getScoreToneClass(selectedPrompt.score)}
          />
          <MetricLine
            label={content.mention}
            value={selectedPrompt.mention ? content.yes : content.no}
            hint={
              selectedPrompt.mention
                ? "La marque apparait explicitement"
                : "La marque n'apparait pas explicitement"
            }
            valueClassName={
              selectedPrompt.mention ? "text-emerald-700" : "text-muted-foreground"
            }
          />
          <MetricLine
            label={content.responseTone}
            value={selectedPromptSentiment.label || notAvailableLabel}
            hint="Qualification globale du ton de la reponse"
            valueClassName={selectedPromptSentiment.toneClass}
          />
          <MetricLine
            label={content.sourceCoverage}
            value={citationCount > 0 ? `${citationCount}` : "0"}
            hint={
              citationCount > 0
                ? "Sources detectees dans la reponse"
                : "Aucune source detectee"
            }
            valueClassName={citationCount > 0 ? "text-primary" : "text-muted-foreground"}
          />
        </div>
      </DetailSection>

      <DetailSection title={content.pagesCited} eyebrow={content.factualAccuracyLabel}>
        {selectedPrompt.citedUrls.length > 0 ? (
          <div className="space-y-2 border-t border-border/50 pt-4">
            {selectedPrompt.citedUrls.map((url) => (
              <div key={url} className="flex items-start gap-3 rounded-2xl bg-muted/18 px-4 py-3">
                <div className="mt-0.5 text-muted-foreground">
                  <Link2 className="h-3.5 w-3.5" />
                </div>
                <span className="min-w-0 break-all text-sm leading-6 text-foreground/88">
                  {url}
                </span>
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
                <p className="truncate text-base font-semibold tracking-tight sm:text-lg">
                  {selectedPromptModelGroup}
                </p>
                {selectedPromptModelName && selectedPromptModelName !== selectedPromptModelGroup ? (
                  <p className="truncate text-sm text-muted-foreground">{selectedPromptModelName}</p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">{selectedPrompt.time}</p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-2 border-border/60 bg-background px-3 text-xs sm:text-sm"
              onClick={() => void handleCopyPrompt()}
            >
              <Copy className="h-3.5 w-3.5" />
              {copyState === "done"
                ? content.promptCopied
                : copyState === "error"
                  ? content.copyUnavailable
                  : content.copyPrompt}
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
            <Badge
              variant="secondary"
              className={cn(
                "h-7 rounded-full border-0 px-3 text-[11px] font-semibold uppercase tracking-[0.08em]",
                selectedPromptSentiment.badgeClass,
              )}
            >
              {content.responseTone}: {selectedPromptSentiment.label}
            </Badge>
            <Badge
              variant="secondary"
              className="h-7 rounded-full border-0 bg-muted/50 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground"
            >
              {content.citations}: {citationCount}
            </Badge>
            {selectedPrompt.rank ? (
              <Badge
                variant="secondary"
                className="h-7 rounded-full border-0 bg-primary/10 px-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-primary"
              >
                {content.rank}: #{selectedPrompt.rank}
              </Badge>
            ) : null}
          </div>
        </div>
      </div>

      {useNativeScroll ? (
        <div className="min-h-0 flex-1 overflow-y-auto">{contentBody}</div>
      ) : (
        <ScrollArea className="min-h-0 flex-1">{contentBody}</ScrollArea>
      )}
    </>
  );
}
