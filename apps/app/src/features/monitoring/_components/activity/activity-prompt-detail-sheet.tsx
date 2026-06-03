import { useCallback, useState } from "react";

import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { MonitoringPrompt } from "../../_lib/shared/monitoring-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { useIsMobile } from "@/shared/hooks/use-mobile";

import { ActivityPromptDetailContent } from "./activity-prompt-detail-content";

type ActivityPromptDetailSheetProps = {
  selectedPrompt: MonitoringPrompt | null;
  onClose: () => void;
  onViewResponse: (prompt: MonitoringPrompt) => void;
};

function ActivityPromptDetailPanel({
  selectedPrompt,
  content,
  onViewResponse,
  mobile,
}: {
  selectedPrompt: MonitoringPrompt;
  content: Record<string, string>;
  onViewResponse: (prompt: MonitoringPrompt) => void;
  mobile: boolean;
}) {
  const [copyState, setCopyState] = useState<"idle" | "done" | "error">("idle");

  const handleCopyPrompt = useCallback(async () => {
    if (
      !selectedPrompt.text ||
      typeof navigator === "undefined" ||
      !navigator.clipboard
    ) {
      setCopyState("error");
      return;
    }

    try {
      await navigator.clipboard.writeText(selectedPrompt.text);
      setCopyState("done");
    } catch {
      setCopyState("error");
    }
  }, [selectedPrompt.text]);

  return (
    <ActivityPromptDetailContent
      content={content}
      copyState={copyState}
      handleCopyPrompt={handleCopyPrompt}
      onViewResponse={onViewResponse}
      selectedPrompt={selectedPrompt}
      mobile={mobile}
    />
  );
}

export function ActivityPromptDetailSheet({
  selectedPrompt,
  onClose,
  onViewResponse,
}: ActivityPromptDetailSheetProps) {
  const isMobile = useIsMobile();
  const content = useI18nScope("monitoring-activity-panel");

  const title = selectedPrompt?.modelGroupName || content.defaultModel;
  const description = selectedPrompt?.text || content.userPrompt;
  const open = !!selectedPrompt;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
        <DrawerContent className="h-[94vh] rounded-t-[32px] border-none bg-white">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>

          {selectedPrompt ? (
            <ActivityPromptDetailPanel
              key={selectedPrompt.text}
              selectedPrompt={selectedPrompt}
              content={content}
              onViewResponse={onViewResponse}
              mobile
            />
          ) : null}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <SheetContent side="right" className="!max-w-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>

        {selectedPrompt ? (
          <ActivityPromptDetailPanel
            key={selectedPrompt.text}
            selectedPrompt={selectedPrompt}
            content={content}
            onViewResponse={onViewResponse}
            mobile={false}
          />
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
