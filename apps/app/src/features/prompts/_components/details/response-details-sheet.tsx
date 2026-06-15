"use client";

import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type { ModelVisual, PromptRunRow } from "../../_lib/types";
import { RichResponseText } from "./rich-response-text";

type ResponseDetailsSheetProps = {
  response: PromptRunRow | null;
  onOpenChange: (open: boolean) => void;
  getModelVisual: (model: string) => ModelVisual;
};

function responseMentionClassName(mentioned: boolean) {
  return mentioned
    ? "border-transparent bg-emerald-50 text-emerald-700"
    : "border-transparent bg-rose-50 text-rose-700";
}

function responseSentimentClassName(sentiment: PromptRunRow["sentiment"]) {
  if (sentiment === "positive") return "border-transparent bg-emerald-50 text-emerald-700";
  if (sentiment === "negative") return "border-transparent bg-rose-50 text-rose-700";
  return "border-transparent bg-amber-50 text-amber-700";
}

function ResponseDataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-5">
      <span className="text-xs font-bold text-primary">{label}</span>
      <span className="min-w-0 text-right text-sm font-semibold [overflow-wrap:anywhere]">{value}</span>
    </div>
  );
}

function ResponseTextBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 pt-2">
      <div className="text-xs font-bold tracking-widest text-primary">{label}</div>
      <div className="rounded-2xl border border-slate-100 px-4 py-4 text-sm leading-7 text-foreground/90 [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}

function ResponseDetailsContent({
  response,
  mobile,
  getModelVisual,
}: {
  response: PromptRunRow;
  mobile: boolean;
  getModelVisual: (model: string) => ModelVisual;
}) {
  const { t } = useScopedI18n("prompts-workspace");
  const visual = getModelVisual(response.model);
  const competitorLabel =
    response.competitors.length > 0 ? response.competitors.join(", ") : t("none");
  const sentimentLabel =
    response.sentiment === "positive"
      ? t("sentimentPositive")
      : response.sentiment === "negative"
        ? t("sentimentNegative")
        : t("sentimentNeutral");

  return (
    <div className={cn("flex h-full flex-col bg-white font-sans antialiased", mobile && "overflow-y-auto")}>
      <div className={cn("px-8 pt-10", mobile && "px-6 pt-6")}>
        <div className="mb-10 flex flex-col items-start justify-between gap-4">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-white px-3 py-1.5 text-sm font-medium text-foreground">
                <img
                  src={visual.icon}
                  alt={visual.provider || visual.name}
                  className="h-4 w-4 object-contain"
                  decoding="async"
                  loading="lazy"
                />
                {visual.name}
              </span>
              <span className="rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-muted-foreground">
                {response.time}
              </span>
              {response.isHistorical ? (
                <Badge variant="outline" className="border-transparent bg-muted text-sm text-muted-foreground">
                  {t("historical")}
                </Badge>
              ) : null}
            </div>

            <h1 className="[overflow-wrap:anywhere] text-xl leading-tight tracking-tight md:text-3xl">
              {response.prompt}
            </h1>
          </div>
        </div>
      </div>

      <div className={cn("flex-1 px-8", mobile ? "px-6" : "overflow-y-auto")}>
        <div className="grid grid-cols-1 gap-y-10 pb-8">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold tracking-widest text-primary">{t("score")}</span>
            <span className="text-4xl font-extralight tracking-tighter text-primary md:text-6xl">
              {response.score}
            </span>
          </div>

          <div className="space-y-7">
            <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-5">
              <span className="text-xs font-bold text-primary">{t("mention")}</span>
              <Badge variant="outline" className={cn("text-sm", responseMentionClassName(response.mention))}>
                {response.mention ? t("mentioned") : t("missing")}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-5">
              <span className="text-xs font-bold text-primary">{t("sentiment")}</span>
              <Badge
                variant="outline"
                className={cn("text-sm", responseSentimentClassName(response.sentiment))}
              >
                {sentimentLabel}
              </Badge>
            </div>
            <ResponseDataRow label={t("rank")} value={response.rank ? `#${response.rank}` : "-"} />
            <ResponseDataRow label={t("competitor")} value={competitorLabel} />
          </div>

          <ResponseTextBlock label={t("response")}>
            <RichResponseText content={response.response} />
          </ResponseTextBlock>

          <ResponseTextBlock label={t("keyPoints")}>
            <ul className="space-y-2">
              {response.highlights.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </ResponseTextBlock>
        </div>
      </div>
    </div>
  );
}

export function ResponseDetailsSheet({ response, onOpenChange, getModelVisual }: ResponseDetailsSheetProps) {
  const isMobile = useIsMobile();
  const { t } = useScopedI18n("prompts-workspace");

  if (!response) return null;

  if (isMobile) {
    return (
      <Drawer open={response !== null} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[94vh] rounded-t-[32px] border-none bg-white">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{t("responseDetailsTitle")}</DrawerTitle>
            <DrawerDescription>
              {response.model} · {response.time}
            </DrawerDescription>
          </DrawerHeader>
          <ResponseDetailsContent response={response} mobile getModelVisual={getModelVisual} />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={response !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!max-w-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{t("responseDetailsTitle")}</SheetTitle>
          <SheetDescription>
            {response.model} · {response.time}
          </SheetDescription>
        </SheetHeader>
        <ResponseDetailsContent response={response} mobile={false} getModelVisual={getModelVisual} />
      </SheetContent>
    </Sheet>
  );
}
