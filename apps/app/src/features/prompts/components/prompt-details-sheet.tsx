"use client";

import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { PromptItem } from "./types";
import { promptStageLabel, promptStatusLabel, relativeRunLabel } from "./prompts-workspace-utils";

type PromptDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: PromptItem | null;
};

function PromptDetailsContent({ prompt, mobile }: { prompt: PromptItem; mobile: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className={cn("border-b px-5 py-4", mobile ? "pt-2" : "px-6 py-5")}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{prompt.rowMode === "global" ? "Vue globale" : "Par IA"}</Badge>
          {prompt.persona ? <Badge variant="outline">{prompt.persona}</Badge> : null}
          <Badge variant="outline">{prompt.runs.length} executions</Badge>
          <Badge variant="outline">{promptStatusLabel(prompt.status)}</Badge>
        </div>

        <div className="mt-3 space-y-2">
          <div className={cn("font-semibold tracking-tight text-foreground", mobile ? "text-lg" : "text-xl")}>
            {prompt.prompt}
          </div>
          <p className="text-sm text-muted-foreground">
            {prompt.rowMode === "global"
              ? "Chiffres agrégés sur toutes les IA de ce prompt."
              : "Chiffres limités à cette IA pour ce prompt."}
          </p>
        </div>
      </div>

      <div className={cn("min-h-0 flex-1 overflow-y-auto", mobile ? "px-5 py-5" : "px-6 py-6")}>
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Vue d'ensemble
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">Mention</div>
                <div className="mt-2 text-xl font-semibold">{prompt.mentionRate}%</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">Classement</div>
                <div className="mt-2 text-xl font-semibold">{prompt.rank.toFixed(1)}</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">SOV</div>
                <div className="mt-2 text-xl font-semibold">{prompt.sov}%</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">Derniere execution</div>
                <div className="mt-2 text-xl font-semibold">{relativeRunLabel(prompt.lastRunMinutes)}</div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Couverture IA
            </div>
            <div className="flex flex-wrap gap-2">
              {prompt.models.length > 0 ? (
                prompt.models.map((model) => (
                  <Badge key={`${prompt.id}-${model}`} variant="outline" className="rounded-full px-3 py-1">
                    {model}
                  </Badge>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">Aucune execution IA pour le moment.</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Cadence d'analyse
            </div>
            <div className="rounded-xl border border-border/70 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">
                  {prompt.schedule.mode === "global" ? "Globale" : "Par IA"}
                </Badge>
                <Badge variant="outline">{prompt.schedule.timezone}</Badge>
                {prompt.effectiveScheduleSource === "override" ? (
                  <Badge variant="outline">Surcharge active</Badge>
                ) : null}
              </div>
              <div className="mt-3 text-base font-semibold">{prompt.effectiveScheduleLabel}</div>
              <div className="mt-1 text-sm text-muted-foreground">
                {prompt.effectiveScheduleSource === "override"
                  ? "Une cadence specifique a cette IA est active sur cette vue."
                  : "Cette cadence est heritee du reglage principal du prompt."}
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Tendance sur 30 jours
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

  if (!prompt) {
    return null;
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[88vh] max-h-[88vh] gap-0 overflow-hidden bg-background p-0">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{prompt.prompt}</DrawerTitle>
            <DrawerDescription>{promptStageLabel(prompt.stage)}</DrawerDescription>
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
          <SheetDescription>{promptStageLabel(prompt.stage)}</SheetDescription>
        </SheetHeader>
        <PromptDetailsContent prompt={prompt} mobile={false} />
      </SheetContent>
    </Sheet>
  );
}
