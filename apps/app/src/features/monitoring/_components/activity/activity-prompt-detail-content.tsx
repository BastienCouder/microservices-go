import type { ReactNode } from "react";
import { Link2, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MonitoringPrompt } from "../../_lib/shared/monitoring-data";
import { cn } from "@/lib/utils";
import { RichResponseText } from "@/features/prompts/_components/details/rich-response-text";

import {
  getScoreToneClass,
  getSentimentMeta,
} from "../../_lib/activity/activity-detail-helpers";

type ActivityPromptDetailContentProps = {
  content: Record<string, string>;
  copyState: "idle" | "done" | "error";
  handleCopyPrompt: () => void | Promise<void>;
  onViewResponse: (prompt: MonitoringPrompt) => void;
  onRequestDelete: (prompt: MonitoringPrompt) => void;
  deleteBusy?: boolean;
  selectedPrompt: MonitoringPrompt;
  mobile: boolean;
};

export function ActivityPromptDetailContent({
  content,
  copyState,
  handleCopyPrompt,
  onViewResponse,
  onRequestDelete,
  deleteBusy = false,
  selectedPrompt,
  mobile,
}: ActivityPromptDetailContentProps) {
  const selectedPromptIconSrc = selectedPrompt.modelIconPath || undefined;
  const selectedPromptModelGroup =
    selectedPrompt.modelGroupName ||
    selectedPrompt.modelDisplayName ||
    selectedPrompt.modelId ||
    content.defaultModel;
  const selectedPromptModelName = selectedPrompt.modelDisplayName || "";
  const selectedPromptSentiment = getSentimentMeta(selectedPrompt.sentiment, content);
  const citationCount = selectedPrompt.citedUrls.length;
  const noDataLabel = content.noDataAvailable;
  const rankLabel = selectedPrompt.rank ? `#${selectedPrompt.rank}` : content.rankUnranked;

  return (
    <div className={cn("flex h-full flex-col bg-white font-sans antialiased", mobile && "overflow-y-auto")}>
      <div className={cn("px-8 pt-10", mobile && "px-6 pt-6")}>
        <div className="mb-10 flex flex-col items-start justify-between gap-4">
          <div className="min-w-0 space-y-4">
            <div className="flex min-w-0 items-center gap-3">
              {selectedPromptIconSrc ? (
                <div className="rounded-md border border-border/50 bg-white p-1.5">
                  <img
                    src={selectedPromptIconSrc}
                    alt={selectedPromptModelGroup}
                    width={20}
                    height={20}
                    loading="lazy"
                    decoding="async"
                    className="h-5 w-5 object-contain"
                  />
                </div>
              ) : null}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground capitalize">
                  {selectedPromptModelGroup}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {selectedPromptModelName && selectedPromptModelName !== selectedPromptModelGroup
                    ? selectedPromptModelName
                    : selectedPrompt.time}
                </p>
              </div>
            </div>
            <h1 className="[overflow-wrap:anywhere] text-xl leading-tight tracking-tight md:text-3xl">
              {selectedPrompt.text}
            </h1>
          </div>
          <div className="flex w-full flex-wrap gap-2">
            <Button
              type="button"
              variant="default"
              className="min-w-0"
              onClick={() => onViewResponse(selectedPrompt)}
            >
              <span className="truncate">{content.viewResponse}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-w-0"
              onClick={() => void handleCopyPrompt()}
            >
              <span className="truncate">
                {copyState === "done"
                  ? content.promptCopied
                  : copyState === "error"
                    ? content.copyUnavailable
                    : content.copyPrompt}
              </span>
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-w-0"
              disabled={deleteBusy}
              onClick={() => onRequestDelete(selectedPrompt)}
            >
              <Trash2 className="h-4 w-4" />
              <span className="truncate">{content.deleteResponse}</span>
            </Button>
          </div>
        </div>
      </div>

      <div className={cn("flex-1 px-8 pb-8", mobile ? "px-6" : "overflow-y-auto")}>
        <div className="grid grid-cols-1 gap-y-12">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold text-primary">{content.score}</span>
            <div className="flex items-baseline gap-3">
              <span className={cn("text-4xl md:text-6xl font-extralight tracking-tighter", getScoreToneClass(selectedPrompt.score))}>
                {selectedPrompt.score}%
              </span>
            </div>
          </div>

          <div className="space-y-7">
            <DetailRow
              label={content.mention}
              value={selectedPrompt.mention ? content.yes : content.no}
              valueClassName={selectedPrompt.mention ? "text-emerald-700" : "text-muted-foreground"}
            />
            <DetailRow
              label={content.rank}
              value={rankLabel}
              valueClassName={selectedPrompt.rank === 1 ? "text-primary" : undefined}
            />
            <DetailRow
              label={content.responseTone}
              value={selectedPromptSentiment.label}
              valueClassName={selectedPromptSentiment.toneClass}
            />
            <DetailRow label={content.sourceCoverage} value={`${citationCount}`} />
            <DetailRow
              label={content.competitors}
              value={
                selectedPrompt.competitorsMentioned.length > 0
                  ? selectedPrompt.competitorsMentioned.join(", ")
                  : noDataLabel
              }
            />
          </div>

          <section className="space-y-4">
            <div className="text-xs font-bold text-primary">
              {content.detailedAnalysis}
            </div>
            <div className="rounded-xl border border-border/50 bg-background px-4 py-4">
              <RichResponseText content={selectedPrompt.response || noDataLabel} />
            </div>
          </section>

          <section className="space-y-4">
            <div className="text-xs font-bold text-primary">
              {content.pagesCited}
            </div>
            {selectedPrompt.citedUrls.length > 0 ? (
              <div className="space-y-2">
                {selectedPrompt.citedUrls.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start gap-3 rounded-md bg-background px-4 py-3 text-sm leading-6 text-foreground/88 transition-all ring-2 ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  >
                    <Link2 className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 break-all">{url}</span>
                  </a>
                ))}
              </div>
            ) : (
              <div className="rounded-md bg-background py-5 text-sm text-muted-foreground">
                {noDataLabel}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  valueClassName,
}: {
  label: string;
  value: ReactNode;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-5">
      <span className="text-xs font-bold text-primary">{label}</span>
      <span className={cn("min-w-0 text-right text-sm font-semibold [overflow-wrap:anywhere]", valueClassName)}>
        {value}
      </span>
    </div>
  );
}
