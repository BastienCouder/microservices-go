import { forwardRef, type ComponentProps } from "react";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";

const RESPONSE_FILTER_TONES = {
  neutral: {
    active: "border-foreground bg-muted/40 text-foreground",
    inactive: "border-border/80 bg-background text-foreground hover:bg-muted/30",
    dot: "border-border/60 bg-background text-muted-foreground",
    dotInner: "bg-muted-foreground/60",
  },
  amber: {
    active:
      "border-amber-300 bg-amber-50 text-amber-900 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.25)]",
    inactive:
      "border-border/80 bg-background text-foreground hover:border-amber-200 hover:bg-amber-50/60 hover:text-amber-900",
    dot: "border-amber-300 bg-amber-50 text-amber-700",
    dotInner: "bg-amber-500",
  },
  emerald: {
    active:
      "border-emerald-200 bg-emerald-50 text-emerald-700 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.16)]",
    inactive:
      "border-border/80 bg-background text-foreground hover:border-emerald-200 hover:bg-emerald-50/60 hover:text-emerald-700",
    dot: "border-emerald-200 bg-emerald-50 text-emerald-700",
    dotInner: "bg-emerald-500",
  },
  rose: {
    active:
      "border-rose-200 bg-rose-50 text-rose-700 shadow-[inset_0_0_0_1px_rgba(244,63,94,0.14)]",
    inactive:
      "border-border/80 bg-background text-foreground hover:border-rose-200 hover:bg-rose-50/60 hover:text-rose-700",
    dot: "border-rose-200 bg-rose-50 text-rose-700",
    dotInner: "bg-rose-500",
  },
} as const;

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
    <tbody ref={ref} className={cn("[&_tr:last-child]:border-0 [&_td]:px-3 [&_td]:py-3", className)} {...props} />
  )),
  TableRow: ({ className, ...props }: ComponentProps<"tr">) => (
    <tr className={cn("cursor-pointer border-b transition-colors hover:bg-muted/50", className)} {...props} />
  ),
};

export function ResponseFilterToggle({
  label,
  active,
  onToggle,
  tone = "neutral",
}: {
  label: string;
  active: boolean;
  onToggle: () => void;
  tone?: keyof typeof RESPONSE_FILTER_TONES;
}) {
  const toneClasses = RESPONSE_FILTER_TONES[tone];

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      aria-pressed={active}
      className={cn(
        "h-9 rounded-lg px-4 text-sm font-medium transition-all",
        active ? toneClasses.active : toneClasses.inactive,
      )}
      onClick={onToggle}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mr-2 flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
          toneClasses.dot,
          active ? "scale-100" : "scale-95 opacity-85",
        )}
      >
        <span className={cn("h-2 w-2 rounded-full", toneClasses.dotInner)} />
      </span>
      {label}
    </Button>
  );
}

export function ResponseCompetitorsCell({ competitors }: { competitors: string[] }) {
  const content = useI18nScope("prompts-workspace");
  const visibleCompetitor = competitors[0] || content.noCompetitor;
  const hiddenCompetitors = competitors.slice(1);

  if (hiddenCompetitors.length === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm">
        {visibleCompetitor}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-sm">
        {visibleCompetitor}
      </span>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex h-7 min-w-7 items-center justify-center rounded-full border border-border/70 bg-background px-2 text-sm font-medium text-muted-foreground"
            aria-label={`${hiddenCompetitors.length} ${content.additionalCompetitors}`}
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

export function formatCompetitorSummary(competitors: string[], noCompetitorLabel: string) {
  if (competitors.length === 0) return noCompetitorLabel;
  if (competitors.length === 1) return competitors[0]!;
  return `${competitors[0]} +${competitors.length - 1}`;
}

export function EmptyResponsesState() {
  const content = useI18nScope("prompts-workspace");

  return <EmptyStateCard label={content.noResponsesForFilters} className="my-4" />;
}
