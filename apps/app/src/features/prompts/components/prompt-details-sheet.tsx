"use client";

import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { PromptItem } from "./types";
import { promptScheduleLabel, promptStageLabel, promptStatusLabel, relativeRunLabel } from "./prompts-workspace-utils";

type PromptDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: PromptItem | null;
};

function PromptDetailsContent({ prompt, mobile }: { prompt: PromptItem; mobile: boolean }) {
  const { locale, t } = useScopedI18n("prompts-workspace");

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={cn("border-b px-5 py-4", mobile ? "pt-2" : "px-6 py-5")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">
            {prompt.rowMode === "global" ? t("rowModeGlobal") : t("rowModeModel")}
          </Badge>
          {/* Persona badge is intentionally paused for now. */}
          <Badge variant="outline">{t("executionCount", { count: prompt.runs.length })}</Badge>
          <Badge variant="outline">{promptStatusLabel(prompt.status, locale)}</Badge>
        </div>

        <div className="mt-3 space-y-2">
          <div className={cn("font-semibold tracking-tight text-foreground", mobile ? "text-lg" : "text-xl")}>
            {prompt.prompt}
          </div>
          <p className="text-sm text-muted-foreground">
            {prompt.rowMode === "global"
              ? t("promptMetricsGlobalDescription")
              : t("promptMetricsModelDescription")}
          </p>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto", mobile ? "px-5 py-5" : "px-6 py-6")}>
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("overviewTitle")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">{t("overviewMention")}</div>
                <div className="mt-2 text-xl font-semibold">{prompt.mentionRate}%</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">{t("overviewRank")}</div>
                <div className="mt-2 text-xl font-semibold">{prompt.rank.toFixed(1)}</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">{t("overviewSov")}</div>
                <div className="mt-2 text-xl font-semibold">{prompt.sov}%</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">{t("overviewLastRun")}</div>
                <div className="mt-2 text-xl font-semibold">
                  {relativeRunLabel(prompt.lastRunMinutes, locale)}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("aiCoverageTitle")}
            </div>
            <div className="flex flex-wrap gap-2">
              {prompt.models.length > 0 ? (
                prompt.models.map((model) => (
                  <Badge key={`${prompt.id}-${model}`} variant="outline" className="rounded-full px-3 py-1">
                    {model}
                  </Badge>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">{t("aiCoverageEmpty")}</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("analysisCadenceTitle")}
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {prompt.schedule.mode === "global" ? t("cadenceGlobal") : t("cadencePerAi")}
                </Badge>
                <Badge variant="outline">{prompt.schedule.timezone}</Badge>
                {prompt.effectiveScheduleSource === "override" ? (
                  <Badge variant="outline">{t("overrideActive")}</Badge>
                ) : null}
              </div>
              <div className="mt-3 text-base font-semibold">
                {promptScheduleLabel(prompt.schedule, prompt.effectiveCron, locale)}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {prompt.effectiveScheduleSource === "override"
                  ? t("cadenceOverrideDescription")
                  : t("cadenceInheritedDescription")}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("trend30dTitle")}
            </div>
            <div className="flex h-24 items-end gap-2 rounded-xl border border-border/70 px-4 py-4">
              {prompt.trend30d.map((value, index) => (
                <div
                  key={`${prompt.id}-trend-${index}`}
                  className="w-full rounded-md bg-primary/80"
                  style={{ height: `${Math.max(12, value)}%` }}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export function PromptDetailsSheet({ open, onOpenChange, prompt }: PromptDetailsSheetProps) {
  const isMobile = useIsMobile();
  const { locale } = useScopedI18n("prompts-workspace");

  if (!prompt) {
    return null;
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[88vh] max-h-[88vh] gap-0 overflow-hidden bg-background p-0">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{prompt.prompt}</DrawerTitle>
            <DrawerDescription>{promptStageLabel(prompt.stage, locale)}</DrawerDescription>
          </DrawerHeader>
          <PromptDetailsContent prompt={prompt} mobile />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full max-w-2xl flex-col gap-0 overflow-hidden bg-background p-0">
        <SheetHeader className="sr-only">
          <SheetTitle>{prompt.prompt}</SheetTitle>
          <SheetDescription>{promptStageLabel(prompt.stage, locale)}</SheetDescription>
        </SheetHeader>
        <PromptDetailsContent prompt={prompt} mobile={false} />
      </SheetContent>
    </Sheet>
  );
}
