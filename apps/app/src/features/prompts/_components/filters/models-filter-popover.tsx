import { Button } from "@/components/ui/button";
import { FloatingPanelHeader } from "@/components/ui/floating-panel-header";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";
import { ChevronDown } from "lucide-react";

type ModelVisual = {
  icon: string;
  description: string;
  label: string;
  provider: string;
  name: string;
};

type ModelsFilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allModelsSelected: boolean;
  selectedModels: string[];
  availableModels: string[];
  loading?: boolean;
  getModelVisual: (model: string) => ModelVisual;
  toggleModel: (model: string) => void;
};

export function ModelsFilterPopover({
  open,
  onOpenChange,
  allModelsSelected,
  selectedModels,
  availableModels,
  loading = false,
  getModelVisual,
  toggleModel,
}: ModelsFilterPopoverProps) {
  const content = useI18nScope("prompts-workspace");
  const { t } = useScopedI18n("prompts-workspace");
  const summaryLabel =
    allModelsSelected
      ? content.allModels
      : t("selectedModels", { count: selectedModels.length });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[220px]">
          <div className="flex min-w-0 items-center gap-2 overflow-hidden text-left">
            <span className="shrink-0 text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {content.models}
            </span>
            <span className="h-1 w-1 shrink-0 rounded-full bg-muted-foreground/50" />
            {loading ? (
              <Skeleton className="h-4 w-24 rounded-full" />
            ) : (
              <span className="truncate text-sm font-medium text-foreground">
                {summaryLabel}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[560px] max-w-[92vw] p-0">
        <FloatingPanelHeader
          title={content.aiCoverageTitle}
          description={content.aiCoverageDescription}
        />
        <div className="grid grid-cols-1 gap-2 px-4 pb-4 pt-1 sm:grid-cols-2">
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="relative flex items-start gap-2 rounded-2xl border border-border/70 p-3"
              >
                <Skeleton className="h-9 w-9 rounded-xl" />
                <div className="min-w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-3 w-40" />
                </div>
                <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
              </div>
            ))
          ) : (
            availableModels.map((model) => {
              const checked = selectedModels.includes(model);
              const highlighted = !allModelsSelected && checked;
              const meta = getModelVisual(model);
              return (
                <button
                  key={model}
                  type="button"
                  onClick={() => toggleModel(model)}
                  className={cn(
                    "relative flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                    highlighted
                      ? "border-primary/30 bg-primary/10"
                      : "border-border/70 bg-background hover:bg-muted/30",
                  )}
                >
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border p-2",
                      highlighted ? "border-primary/30 bg-primary/10" : "border-border/50 bg-background",
                    )}
                  >
                    <img src={meta.icon} alt={model} className="h-full w-full object-contain opacity-85" decoding="async" />
                  </div>
                  <div className="min-w-0">
                    <div className={cn("truncate text-sm font-semibold leading-tight", highlighted ? "text-primary" : "text-foreground")}>
                      {meta.label}
                    </div>
                    <div className={cn("line-clamp-1 text-xs leading-snug", highlighted ? "text-primary/75" : "text-muted-foreground")}>
                      {meta.provider} {meta.name !== meta.label ? `· ${meta.name}` : ""}
                    </div>
                  </div>
                  <div className={cn("ml-auto mt-1 h-2.5 w-2.5 rounded-full", highlighted ? "bg-primary" : "bg-muted-foreground/30")} />
                </button>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
