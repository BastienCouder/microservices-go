import { forwardRef, type ComponentProps } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const virtuosoTableComponents = {
  Scroller: forwardRef<HTMLDivElement, ComponentProps<"div">>(({ className, ...props }, ref) => (
    <div ref={ref} className={cn("h-full overflow-auto [contain:strict]", className)} {...props} />
  )),
  Table: ({ className, ...props }: ComponentProps<"table">) => (
    <table className={cn("w-full min-w-[980px] caption-bottom text-sm", className)} {...props} />
  ),
  TableHead: forwardRef<HTMLTableSectionElement, ComponentProps<"thead">>(({ className, ...props }, ref) => (
    <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
  )),
  TableBody: forwardRef<HTMLTableSectionElement, ComponentProps<"tbody">>(({ className, ...props }, ref) => (
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
  )),
  TableRow: ({ className, ...props }: ComponentProps<"tr">) => (
    <tr className={cn("hover:bg-muted/50 border-b transition-colors", className)} {...props} />
  ),
};

export function ResponseFilterToggle({
  label,
  active,
  onToggle,
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className={cn(
        "h-8 rounded-full px-3 text-xs sm:h-7 sm:px-2.5",
        active ? "border-primary/40 bg-primary/5" : "border-border/70 bg-background hover:bg-muted/20",
      )}
      onClick={onToggle}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mr-2 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-primary/50",
          active ? "bg-primary/12" : "bg-transparent",
        )}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      </span>
      {label}
    </Button>
  );
}

export function ResponseCompetitorsCell({ competitors }: { competitors: string[] }) {
  const visibleCompetitor = competitors[0] || "Aucun";
  const hiddenCompetitors = competitors.slice(1);

  if (hiddenCompetitors.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
        {visibleCompetitor}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs">
        {visibleCompetitor}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border/70 bg-background px-2 text-[11px] font-medium text-muted-foreground"
            aria-label={`${hiddenCompetitors.length} concurrents supplementaires`}
          >
            +{hiddenCompetitors.length}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={6} className="max-w-sm">
          <div className="space-y-1">
            {hiddenCompetitors.map((competitor) => (
              <div key={competitor}>{competitor}</div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export function formatCompetitorSummary(competitors: string[]) {
  if (competitors.length === 0) return "Aucun";
  if (competitors.length === 1) return competitors[0]!;
  return `${competitors[0]} +${competitors.length - 1}`;
}

export function EmptyResponsesState() {
  return (
    <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-sm text-muted-foreground">
      Aucune reponse pour les filtres selectionnes.
    </div>
  );
}
