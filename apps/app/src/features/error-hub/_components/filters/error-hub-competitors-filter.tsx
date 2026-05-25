import { ChevronDown } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function ErrorHubCompetitorsFilter({
  allCompetitorsSelected,
  availableCompetitors,
  onOpenChange,
  open,
  selectedCompetitors,
  toggleCompetitor,
}: {
  allCompetitorsSelected: boolean;
  availableCompetitors: string[];
  onOpenChange: (open: boolean) => void;
  open: boolean;
  selectedCompetitors: string[];
  toggleCompetitor: (competitor: string) => void;
}) {
  const summaryLabel = allCompetitorsSelected
    ? "Tous les concurrents"
    : `${selectedCompetitors.length} sélectionné${selectedCompetitors.length > 1 ? "s" : ""}`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[220px]"
        >
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Concurrents
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            <span className="truncate text-sm font-medium text-foreground">
              {summaryLabel}
            </span>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-[360px] max-w-[92vw] p-0">
        <FloatingPanelHeader
          title="Concurrents"
          description="Filtrer les erreurs qui mentionnent un concurrent."
        />

        <div className="grid grid-cols-1 gap-2 px-4 pb-4 pt-1">
          {availableCompetitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/70 p-3 text-sm text-muted-foreground">
              Aucun concurrent disponible
            </div>
          ) : (
            availableCompetitors.map((competitor) => {
              const checked = selectedCompetitors.includes(competitor);
              const highlighted = !allCompetitorsSelected && checked;

              return (
                <button
                  key={competitor}
                  type="button"
                  onClick={() => toggleCompetitor(competitor)}
                  className={cn(
                    "relative flex items-center gap-3 rounded-2xl border p-3 text-left transition-colors",
                    highlighted
                      ? "border-primary/30 bg-primary/10"
                      : "border-border/70 bg-background hover:bg-muted/30",
                  )}
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      highlighted ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                  />
                  <span
                    className={cn(
                      "min-w-0 truncate text-sm font-semibold",
                      highlighted ? "text-primary" : "text-foreground",
                    )}
                  >
                    {competitor}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}