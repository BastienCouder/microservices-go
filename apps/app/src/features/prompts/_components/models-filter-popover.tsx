import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type ModelVisual = {
  icon: string;
  description: string;
  label: string;
};

type ModelsFilterPopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allModelsSelected: boolean;
  selectedModels: string[];
  availableModels: string[];
  getModelVisual: (model: string) => ModelVisual;
  toggleModel: (model: string) => void;
};

export function ModelsFilterPopover({
  open,
  onOpenChange,
  allModelsSelected,
  selectedModels,
  availableModels,
  getModelVisual,
  toggleModel,
}: ModelsFilterPopoverProps) {
  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="h-8 text-xs">
          {allModelsSelected ? "Models: All" : `Models (${selectedModels.length})`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[560px] max-w-[92vw] p-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {availableModels.map((model) => {
            const checked = selectedModels.includes(model);
            const highlighted = !allModelsSelected && checked;
            const meta = getModelVisual(model);
            return (
              <button
                key={model}
                type="button"
                onClick={() => toggleModel(model)}
                className={cn(
                  "relative flex items-start gap-2 rounded-lg border p-2.5 text-left transition-all",
                  highlighted
                    ? "border-primary bg-primary/4 ring-1 ring-primary"
                    : "border-border bg-card hover:border-muted-foreground/30 hover:bg-muted/30",
                )}
              >
                <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 p-1.5">
                  <img src={meta.icon} alt={model} className="h-full w-full object-contain opacity-80" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-tight text-foreground">{meta.label}</div>
                  <div className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">{meta.description}</div>
                </div>
                <div className={cn("ml-auto mt-0.5 h-3 w-3 rounded-full", highlighted ? "bg-primary" : "bg-muted")} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
