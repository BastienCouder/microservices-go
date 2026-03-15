import { useCallback, useEffect, useState } from "react";

import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import type { MonitoringPrompt } from "@/hooks/use-monitoring-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { useIsMobile } from "@/shared/hooks/use-mobile";

import { ActivityPromptDetailContent } from "./activity-prompt-detail-content";

type ActivityPromptDetailSheetProps = {
  selectedPrompt: MonitoringPrompt | null;
  onClose: () => void;
};

export function ActivityPromptDetailSheet({
  selectedPrompt,
  onClose,
}: ActivityPromptDetailSheetProps) {
  const isMobile = useIsMobile();
  const content = useI18nScope("monitoring-activity-panel");
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

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

  if (isMobile) {
    return (
      <Drawer open={!!selectedPrompt} onOpenChange={(open) => !open && onClose()}>
        <DrawerContent className="h-[92vh] max-h-[92vh] gap-0 overflow-hidden bg-background p-0">
          {selectedPrompt ? (
            <ActivityPromptDetailContent
              content={content}
              copyState={copyState}
              handleCopyPrompt={handleCopyPrompt}
              selectedPrompt={selectedPrompt}
              headerClassName="px-5 pb-4 pt-2"
              bodyClassName="space-y-8 px-5 py-5"
              useNativeScroll
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={!!selectedPrompt} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-hidden border-l border-border/60 bg-background p-0 sm:max-w-[640px]">
        {selectedPrompt ? (
          <ActivityPromptDetailContent
            content={content}
            copyState={copyState}
            handleCopyPrompt={handleCopyPrompt}
            selectedPrompt={selectedPrompt}
            headerClassName="px-6 py-5"
            bodyClassName="space-y-10 px-6 py-6"
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
