"use client";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PromptItem } from "./types";

type PromptDetailsSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: PromptItem | null;
};

export function PromptDetailsSheet({ open, onOpenChange, prompt }: PromptDetailsSheetProps) {
  return (
    <Sheet open={open && prompt !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[95vw] p-0 sm:max-w-md 2xl:hidden">
        {prompt && (
          <div className="h-full overflow-auto p-5">
            <SheetHeader className="p-0">
              <SheetTitle>{prompt.prompt}</SheetTitle>
              <SheetDescription>
                {prompt.stage} · {prompt.persona}
              </SheetDescription>
            </SheetHeader>

            <div className="mt-4 space-y-2">
              <div className="text-sm font-medium">30-day trend mini chart</div>
              <div className="flex h-14 items-end gap-1 rounded-md border p-2">
                {prompt.trend30d.map((value, index) => (
                  <div
                    key={`${prompt.id}-mobile-${index}`}
                    className="w-full rounded-sm bg-primary/70"
                    style={{ height: `${Math.max(10, value)}%` }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Mention rate</span>
                <span className="font-semibold">{prompt.mentionRate}%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Runs</span>
                <span className="font-semibold">{prompt.runs.length} total</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">SOV</span>
                <span className="font-semibold">{prompt.sov}%</span>
              </div>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
