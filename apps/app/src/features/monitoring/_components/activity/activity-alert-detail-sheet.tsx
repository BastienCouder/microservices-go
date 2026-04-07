import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { MonitoringData } from "@/lib/monitoring-data";
import { useI18nScope } from "@/shared/hooks/use-i18n";

import { getAlertTypeLabel } from "../../_lib/activity/activity-detail-helpers";

type MonitoringAlert = MonitoringData["alerts"][number];

type ActivityAlertDetailSheetProps = {
  selectedAlert: MonitoringAlert | null;
  onClose: () => void;
};

export function ActivityAlertDetailSheet({
  selectedAlert,
  onClose,
}: ActivityAlertDetailSheetProps) {
  const content = useI18nScope("monitoring-activity-panel");

  return (
    <Sheet open={!!selectedAlert} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="flex w-full flex-col border-l border-border/60 bg-background p-0 sm:w-[340px]">
        {selectedAlert ? (
          <>
            <SheetHeader className="border-b border-border/60 bg-card p-5">
              <div className="mb-2 flex items-center gap-2">
                <Badge variant="secondary" className="h-6 bg-primary/10 px-2 text-xs font-semibold text-primary">
                  {content.alertInsight}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {getAlertTypeLabel(selectedAlert.prompts, content) || selectedAlert.time}
                </span>
              </div>
              <SheetTitle className="text-base font-semibold leading-snug">
                {selectedAlert.msg}
              </SheetTitle>
            </SheetHeader>

            <div className="flex-1 space-y-4 p-5">
              <div className="space-y-3 rounded-md border border-border/60 bg-card p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {content.triggerPrompt}
                </p>
                <div className="rounded-md border border-border/50 bg-muted/40 p-3 text-[12px] italic leading-relaxed text-foreground/80">
                  {selectedAlert.prompts || content.noDataAvailable}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-border/60 bg-card p-3">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground">
                    {content.score}
                  </p>
                  <p className="mt-1 font-mono text-sm font-bold text-primary">
                    {content.notAvailable}
                  </p>
                </div>
                <div className="rounded-md border border-border/60 bg-card p-3">
                  <p className="text-[9px] font-bold uppercase text-muted-foreground">
                    {content.mentions}
                  </p>
                  <p className="mt-1 text-sm font-bold">{content.notAvailable}</p>
                </div>
              </div>
            </div>

            <div className="border-t border-border/60 bg-card p-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full border-border/60 text-xs md:text-sm"
                onClick={onClose}
              >
                {content.close}
              </Button>
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
