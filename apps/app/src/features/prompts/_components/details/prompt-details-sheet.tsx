"use client";

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type { ModelVisual, PromptItem, PromptRun } from "../../_lib/types";
import {
  comparePromptRunsByRecency,
  promptScheduleLabel,
  promptStageLabel,
  relativeRunLabel,
} from "../../_lib/utils";
import { RichResponseText } from "./rich-response-text";
import { PromptLanguageIndicator } from "../shared/prompt-language-indicator";

type GetModelVisual = (model: string) => ModelVisual;

function PromptDetailsContent({
  prompt,
  mobile,
  getModelVisual,
  onEditPrompt,
  onSeeMoreResponses,
  onOpenResponse,
}: {
  prompt: PromptItem;
  mobile: boolean;
  getModelVisual: GetModelVisual;
  onEditPrompt?: (prompt: PromptItem) => void;
  onSeeMoreResponses: (prompt: PromptItem) => void;
  onOpenResponse: (prompt: PromptItem, responseId: string) => void;
}) {
  const { locale, t } = useScopedI18n("prompts-workspace");
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");
  const chartData = useMemo(
    () => prompt.trend30d.map((value, day) => ({ day, value })),
    [prompt.trend30d],
  );
  const cadenceLabel = useMemo(
    () => promptScheduleLabel(prompt.schedule, prompt.effectiveCron, locale),
    [prompt.schedule, prompt.effectiveCron, locale],
  );
  const modelItems = useMemo(
    () =>
      prompt.models.map((model) => {
        const visual = getModelVisual(model);
        return {
          model,
          icon: visual.icon,
          label: `${visual.provider} ${visual.name}`.trim(),
        };
      }),
    [prompt.models, getModelVisual],
  );
  const chartGradientId = useMemo(() => `prompt-details-chart-${prompt.id}`, [prompt.id]);
  const lastResponses = useMemo(
    () =>
      [...prompt.runs]
        .sort(comparePromptRunsByRecency)
        .slice(0, 5),
    [prompt.runs],
  );
  const handleCopyPrompt = useCallback(async () => {
    if (!prompt.prompt || typeof navigator === "undefined" || !navigator.clipboard) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(prompt.prompt);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
  }, [prompt.prompt]);

  useEffect(() => {
    setCopyState("idle");
  }, [prompt.id]);

  return (
    <div className={cn("flex h-full flex-col bg-white font-sans antialiased", mobile && "overflow-y-auto")}>
      <div className={cn("px-8 pt-10", mobile && "px-6 pt-6")}>
        <div className="mb-10 flex flex-col items-start justify-between gap-4">
          <div className="min-w-0 space-y-2">
            <h1 className="[overflow-wrap:anywhere] text-xl leading-tight tracking-tight md:text-3xl">
              {prompt.prompt}
            </h1>
          </div>
          <div className="flex w-full flex-wrap gap-2">
            {onEditPrompt ? (
              <Button
                type="button"
                variant="default"
                className="min-w-0 rounded-full"
                onClick={() => onEditPrompt(prompt)}
              >
             <span className="truncate">{t("editLabel")}</span>
              </Button>
            ) : null}
           
            <Button
              type="button"
              variant="outline"
              className="min-w-0 rounded-full"
              onClick={() => onSeeMoreResponses(prompt)}
            >
              <span className="truncate">{t("viewResponsesLabel")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-w-0 rounded-full"
              onClick={() => void handleCopyPrompt()}
            >
              <span className="truncate">
                {copyState === "done"
                  ? t("promptCopied")
                  : copyState === "error"
                    ? t("promptCopyUnavailable")
                    : t("copyPrompt")}
              </span>
            </Button>
          </div>
        </div>
      </div>

      <div className={cn("flex-1 px-8", mobile ? "px-6" : "overflow-y-auto")}>
        <div className="grid grid-cols-1 gap-y-12 pb-8">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold tracking-widest text-primary">{t("sovScoreLabel")}</span>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl md:text-6xl font-extralight tracking-tighter text-primary">{prompt.sov}%</span>
            </div>
          </div>

          <div className="space-y-7">
            <DataRow label={t("overviewMention")} value={`${prompt.mentionRate}%`} />
            <DataRow
              label={t("overviewRank")}
              value={prompt.rank !== null ? prompt.rank.toFixed(1) : "-"}
            />
            <DataRow
              label={t("overviewLanguage")}
              value={
                <PromptLanguageIndicator
                  language={prompt.language}
                  label={prompt.language === "en" ? t("languageEnglish") : t("languageFrench")}
                  className="justify-end"
                  flagClassName="text-sm"
                />
              }
            />
            <DataRow label={t("analysisCadenceTitle")} value={cadenceLabel} />

            <div className="flex items-center justify-between border-b border-slate-50 pb-5">
              <span className="text-xs font-bold text-primary tracking-wider">{t("aiCoverageTitle")}</span>
              <TooltipProvider delayDuration={120}>
                <div className="flex gap-3">
                  {modelItems.map((item) => (
                    <Tooltip key={item.model}>
                      <TooltipTrigger asChild>
                        <span
                          className="inline-flex items-center justify-center opacity-90 transition-opacity hover:opacity-100"
                          aria-label={item.label}
                        >
                          <img
                            src={item.icon}
                            alt={item.label}
                            className="h-5 w-5 object-contain"
                            decoding="async"
                            loading="lazy"
                          />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="top" sideOffset={6}>
                        {item.label}
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </TooltipProvider>
            </div>
          </div>

          <div className="pt-4">
            <div className="mb-6 flex items-center justify-between">
              <span className="text-xs font-bold tracking-widest text-primary">{t("trend30dTitle")}</span>
            </div>
            <div className="h-32 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id={chartGradientId} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.12}/>
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#2563eb"
                    strokeWidth={1.2}
                    fillOpacity={1}
                    fill={`url(#${chartGradientId})`}
                    animationDuration={1500}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <LastResponses
            locale={locale}
            responses={lastResponses}
            getModelVisual={getModelVisual}
            emptyLabel={t("noResponsesYet")}
            title={t("lastResponsesTitle")}
            onSeeMore={() => onSeeMoreResponses(prompt)}
            onOpenResponse={(responseId) => onOpenResponse(prompt, responseId)}
          />
        </div>
      </div>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-5">
      <span className="text-xs font-bold text-primary">{label}</span>
      <span className="min-w-0 text-right text-sm font-semibold [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function LastResponses({
  title,
  emptyLabel,
  locale,
  responses,
  getModelVisual,
  onSeeMore,
  onOpenResponse,
}: {
  title: string;
  emptyLabel: string;
  locale: string;
  responses: PromptRun[];
  getModelVisual: GetModelVisual;
  onSeeMore: () => void;
  onOpenResponse: (responseId: string) => void;
}) {
  const { t } = useScopedI18n("prompts-workspace");

  if (responses.length === 0) {
    return (
      <div className="space-y-3 pt-2">
        <div className="text-xs font-bold tracking-widest text-primary">{title}</div>
        <EmptyStateCard label={emptyLabel} className="h-auto min-h-16 border-slate-100" />
      </div>
    );
  }

  return (
    <div className="space-y-8 py-2">
      <div className="text-xs font-bold tracking-widest text-primary">{title}</div>
      <div className="space-y-4">
        {responses.map((response) => {
          const visual = getModelVisual(response.model);
          const modelGroup = visual.provider;
          const modelName = visual.name;

          return (
            <button
              type="button"
              key={response.id}
              className="group w-full cursor-pointer rounded-md bg-background p-4 text-left transition-all ring-2 ring-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label={`${title}: ${modelGroup}`}
              onClick={() => onOpenResponse(response.id)}
            >
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="rounded-md border border-border/50 bg-white p-1">
                    <img
                      src={visual.icon}
                      alt={modelName || modelGroup}
                      width={14}
                      height={14}
                      loading="lazy"
                      decoding="async"
                      className="h-3.5 w-3.5 object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-foreground md:text-sm capitalize">{modelGroup}</p>
                    {modelName && modelName !== modelGroup ? (
                      <p className="truncate text-xs text-muted-foreground md:text-xs lowercase">{modelName}</p>
                    ) : null}
                  </div>
                </div>
                <span className="font-mono text-xs text-muted-foreground">
                  {relativeRunLabel(response.minutesAgo, locale)}
                </span>
              </div>

              <div className="mb-3 rounded-xl border border-border/50 bg-muted/20 px-3 py-3 transition-colors group-hover:bg-muted/30">
                <RichResponseText
                  content={response.response}
                  compact
                  className="max-h-48 overflow-hidden [mask-image:linear-gradient(to_bottom,black_80%,transparent)]"
                />
              </div>

              <div className="flex items-center justify-between border-t border-border/40 pt-3">
                <div className="flex items-center gap-3">
                  {response.mention ? (
                    <span className="rounded-sm text-xs font-semibold text-emerald-600">{t("mentionedLabel")}</span>
                  ) : (
                    <span className="rounded-sm text-xs font-medium text-destructive">{t("missingLabel")}</span>
                  )}
                  {response.rank ? (
                    <>
                      <div className="h-[12px] w-[1px] bg-border" />
                      <span className={cn("text-xs", response.rank === 1 ? "font-semibold text-primary" : "text-muted-foreground")}>
                        {t("rankLabel", { rank: response.rank })}
                      </span>
                    </>
                  ) : null}
                </div>
                <div
                  className={cn(
                    "flex h-6 items-center rounded-sm px-2 text-xs font-bold",
                    response.score > 80 ? "bg-green-500/10 text-green-700" : response.score > 50 ? "bg-amber-500/10 text-amber-700" : "bg-destructive/10 text-destructive",
                  )}
                >
                  {response.score}
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        
        className="w-full min-w-0 text-xs md:text-sm"
        onClick={onSeeMore}
      >
        <span className="truncate">{t("seeMoreLabel")}</span>
      </Button>
    </div>
  );
}

export function PromptDetailsSheet({
  open,
  onOpenChange,
  prompt,
  getModelVisual,
  onEditPrompt,
  onSeeMoreResponses,
  onOpenResponse,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: PromptItem | null;
  getModelVisual: GetModelVisual;
  onEditPrompt?: (prompt: PromptItem) => void;
  onSeeMoreResponses: (prompt: PromptItem) => void;
  onOpenResponse: (prompt: PromptItem, responseId: string) => void;
}) {
  const isMobile = useIsMobile();
  const { locale } = useScopedI18n("prompts-workspace");

  if (!prompt) return null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[94vh] border-none bg-white rounded-t-[32px]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{prompt.prompt}</DrawerTitle>
            <DrawerDescription>{promptStageLabel(prompt.stage, locale)}</DrawerDescription>
          </DrawerHeader>
          <PromptDetailsContent
            prompt={prompt}
            mobile
            getModelVisual={getModelVisual}
            onEditPrompt={onEditPrompt}
            onSeeMoreResponses={onSeeMoreResponses}
            onOpenResponse={onOpenResponse}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!max-w-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{prompt.prompt}</SheetTitle>
          <SheetDescription>{promptStageLabel(prompt.stage, locale)}</SheetDescription>
        </SheetHeader>
        <PromptDetailsContent
          prompt={prompt}
          mobile={false}
          getModelVisual={getModelVisual}
          onEditPrompt={onEditPrompt}
          onSeeMoreResponses={onSeeMoreResponses}
          onOpenResponse={onOpenResponse}
        />
      </SheetContent>
    </Sheet>
  );
}
