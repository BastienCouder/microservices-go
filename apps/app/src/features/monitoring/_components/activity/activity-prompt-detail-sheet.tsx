import { useCallback, useEffect, useState } from "react";

import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MonitoringPrompt } from "@/hooks/use-monitoring-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { useIsMobile } from "@/shared/hooks/use-mobile";

import { ActivityPromptDetailContent } from "./activity-prompt-detail-content";

type ActivityPromptDetailSheetProps = {
  selectedPrompt: MonitoringPrompt | null;
  onClose: () => void;
  onViewResponse: (prompt: MonitoringPrompt) => void;
};

export function ActivityPromptDetailSheet({
  selectedPrompt,
  onClose,
  onViewResponse,
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
        <DrawerContent className="h-[94vh] border-none bg-white rounded-t-[32px]">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{selectedPrompt?.modelGroupName || content.defaultModel}</DrawerTitle>
            <DrawerDescription>{selectedPrompt?.text || content.userPrompt}</DrawerDescription>
          </DrawerHeader>
          {selectedPrompt ? (
            <ActivityPromptDetailContent
              content={content}
              copyState={copyState}
              handleCopyPrompt={handleCopyPrompt}
              onViewResponse={onViewResponse}
              selectedPrompt={selectedPrompt}
              mobile
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={!!selectedPrompt} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="!max-w-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{selectedPrompt?.modelGroupName || content.defaultModel}</SheetTitle>
          <SheetDescription>{selectedPrompt?.text || content.userPrompt}</SheetDescription>
        </SheetHeader>
        {selectedPrompt ? (
          <ActivityPromptDetailContent
            content={content}
            copyState={copyState}
            handleCopyPrompt={handleCopyPrompt}
            onViewResponse={onViewResponse}
            selectedPrompt={selectedPrompt}
            mobile={false}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
