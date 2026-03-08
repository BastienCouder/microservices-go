"use client";

import { Badge } from "@/components/ui/badge";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import { PromptItem } from "./types";

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
          <Badge variant="outline">{prompt.rowMode === "global" ? "Global" : "Par IA"}</Badge>
          {prompt.persona ? <Badge variant="outline">{prompt.persona}</Badge> : null}
          <Badge variant="outline">{prompt.runs.length} runs</Badge>
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
              Overview
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">Mention</div>
                <div className="mt-2 text-xl font-semibold">{prompt.mentionRate}%</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">Rank</div>
                <div className="mt-2 text-xl font-semibold">{prompt.rank.toFixed(1)}</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">SOV</div>
                <div className="mt-2 text-xl font-semibold">{prompt.sov}%</div>
              </div>
              <div className="rounded-xl border border-border/70 p-4">
                <div className="text-xs text-muted-foreground">Last run</div>
                <div className="mt-2 text-xl font-semibold">
                  {prompt.lastRunMinutes < 60
                    ? `${prompt.lastRunMinutes}m ago`
                    : `${Math.floor(prompt.lastRunMinutes / 60)}h ago`}
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              AI scope
            </div>
            <div className="flex flex-wrap gap-2">
              {prompt.models.length > 0 ? (
                prompt.models.map((model) => (
                  <Badge key={`${prompt.id}-${model}`} variant="outline" className="rounded-full px-3 py-1">
                    {model}
                  </Badge>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">No AI runs yet.</div>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              30-day trend
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
            <DrawerDescription>{prompt.stage}</DrawerDescription>
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
          <SheetDescription>{prompt.stage}</SheetDescription>
        </SheetHeader>
        <PromptDetailsContent prompt={prompt} mobile={false} />
      </SheetContent>
    </Sheet>
  );
}
