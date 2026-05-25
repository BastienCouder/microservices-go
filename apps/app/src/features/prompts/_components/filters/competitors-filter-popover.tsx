import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";

type CompetitorsFilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedCompetitors: string[];
  toggleCompetitor: (value: string) => void;
  clearCompetitors: () => void;
  availableCompetitors: string[];
  loading?: boolean;
};

export function CompetitorsFilterPopover({
  open,
  onOpenChange,
  selectedCompetitors,
  toggleCompetitor,
  clearCompetitors,
  availableCompetitors,
  loading = false,
}: CompetitorsFilterPopoverProps) {
  const content = useI18nScope("prompts-workspace");
  const selectedCompetitorLabel =
    selectedCompetitors.length === 0
      ? content.allCompetitors
      : selectedCompetitors.length === 1
        ? selectedCompetitors[0]!
        : `${selectedCompetitors.length} ${content.competitorsSelected}`;

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[240px] sm:max-w-[360px]"
          title={selectedCompetitorLabel}
        >
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {content.competitors}
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            {loading ? (
              <Skeleton className="h-4 w-24 rounded-full" />
            ) : (
              <span className="truncate text-sm font-medium text-foreground">
                {selectedCompetitorLabel}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[560px] max-w-[92vw] p-0">
        <FloatingPanelHeader
          title={content.topCompetitorsTitle}
          description={content.topCompetitorsDescription}
        />
        <div className="grid grid-cols-1 gap-2 px-4 pb-4 pt-1 sm:grid-cols-2">
          <button
            type="button"
            onClick={clearCompetitors}
            className={cn(
              "relative flex cursor-pointer items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
              selectedCompetitors.length === 0
                ? "border-primary/30 bg-primary/10"
                : "border-border/70 bg-background hover:bg-muted/30",
            )}
          >
            <div className="min-w-0 flex-1">
              <div
                className={cn(
                  "truncate text-sm font-semibold leading-tight",
                  selectedCompetitors.length === 0 ? "text-primary" : "text-foreground",
                )}
              >
                {content.allCompetitors}
              </div>
            </div>
            <div
              className={cn(
                "ml-auto mt-1 h-2.5 w-2.5 rounded-full",
                selectedCompetitors.length === 0 ? "bg-primary" : "bg-muted-foreground/30",
              )}
            />
          </button>
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="relative flex items-start gap-2 rounded-2xl border border-border/70 p-3"
              >
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-4 w-32" />
                </div>
                <Skeleton className="ml-auto mt-1 h-2.5 w-2.5 rounded-full" />
              </div>
            ))
          ) : (
            availableCompetitors.map((item) => {
              const highlighted = selectedCompetitors.includes(item);

              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleCompetitor(item)}
                  className={cn(
                    "relative flex cursor-pointer items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                    highlighted
                      ? "border-primary/30 bg-primary/10"
                      : "border-border/70 bg-background hover:bg-muted/30",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        "truncate text-sm font-semibold leading-tight",
                        highlighted ? "text-primary" : "text-foreground",
                      )}
                    >
                      {item}
                    </div>
                  </div>
                  <div
                    className={cn(
                      "ml-auto mt-1 h-2.5 w-2.5 rounded-full",
                      highlighted ? "bg-primary" : "bg-muted-foreground/30",
                    )}
                  />
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
