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
import type { OptimizationError } from "@/lib/optimization-errors-data";

import { ErrorDetailsContent } from "../../perception/_components";
type ErrorHubDetailsPanelProps = {
  actionStatusesByErrorId: ReadonlyMap<string, string>;
  generatedIds: ReadonlySet<string>;
  getContextBadge: (
    error: OptimizationError,
  ) => { label: string; className: string } | undefined;
  getContextMeta: (
    error: OptimizationError,
  ) => { label: string; value: string } | undefined;
  isMobile: boolean;
  locale: string;
  markingDoneErrorIds: ReadonlySet<string>;
  modelLookup: ReturnType<
    typeof import("../../perception/_components").buildPerceptionModelLookup
  >;
  onCreateAction: (error: OptimizationError) => void | Promise<void>;
  onMarkDone: (error: OptimizationError) => void | Promise<void>;
  onOpenChange: (open: boolean) => void;
  savingErrorIds: ReadonlySet<string>;
  selectedError: OptimizationError | null;
  sheetDescription: string;
};

export function ErrorHubDetailsPanel({
  actionStatusesByErrorId,
  generatedIds,
  getContextBadge,
  getContextMeta,
  isMobile,
  locale,
  markingDoneErrorIds,
  modelLookup,
  onCreateAction,
  onMarkDone,
  onOpenChange,
  savingErrorIds,
  selectedError,
  sheetDescription,
}: ErrorHubDetailsPanelProps) {
  if (!selectedError) return null;

  const content = (
    <ErrorDetailsContent
      contextBadge={getContextBadge(selectedError)}
      contextMeta={getContextMeta(selectedError)}
      error={selectedError}
      locale={locale}
      modelLookup={modelLookup}
      mobile={isMobile}
      actionGenerated={generatedIds.has(selectedError.id)}
      actionSaving={savingErrorIds.has(selectedError.id)}
      actionStatus={actionStatusesByErrorId.get(selectedError.id)}
      markingActionDone={markingDoneErrorIds.has(selectedError.id)}
      onCreateAction={() => void onCreateAction(selectedError)}
      onMarkActionDone={() => void onMarkDone(selectedError)}
    />
  );

  if (isMobile) {
    return (
      <Drawer open={selectedError !== null} onOpenChange={onOpenChange}>
        <DrawerContent className="h-[94vh] rounded-t-[32px] border-none bg-white">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{selectedError.title}</DrawerTitle>
            <DrawerDescription>{sheetDescription}</DrawerDescription>
          </DrawerHeader>

          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={selectedError !== null} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="!max-w-2xl">
        <SheetHeader className="sr-only">
          <SheetTitle>{selectedError.title}</SheetTitle>
          <SheetDescription>{sheetDescription}</SheetDescription>
        </SheetHeader>

        {content}
      </SheetContent>
    </Sheet>
  );
}