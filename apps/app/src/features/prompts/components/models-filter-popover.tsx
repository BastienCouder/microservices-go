import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
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
        <Button variant="outline" className="h-10 w-full justify-between rounded-full border-border/80 bg-background px-4 text-xs sm:h-8 sm:w-auto sm:min-w-[220px]">
          <span className="min-w-0 text-left">
            <span className="block text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              Modeles
            </span>
            <span className="block truncate text-sm font-medium text-foreground">
              {allModelsSelected ? "Tous" : `${selectedModels.length} selectionnes`}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[560px] max-w-[92vw] p-0">
        <PopoverHeader className="px-4 pt-4">
          <PopoverTitle>Couverture IA</PopoverTitle>
          <PopoverDescription>Selectionnez les modeles.</PopoverDescription>
        </PopoverHeader>
        <div className="grid grid-cols-1 gap-2 px-4 pb-4 pt-1 sm:grid-cols-2">
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
                  "relative flex items-start gap-2 rounded-2xl border p-3 text-left transition-colors",
                  highlighted
                    ? "border-foreground bg-muted/40"
                    : "border-border/70 bg-background hover:bg-muted/30",
                )}
              >
                <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-border/50 bg-background p-2">
                  <img src={meta.icon} alt={model} className="h-full w-full object-contain opacity-85" decoding="async" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold leading-tight text-foreground">{meta.label}</div>
                  <div className="line-clamp-1 text-[11px] leading-snug text-muted-foreground">
                    {meta.provider} {meta.name !== meta.label ? `· ${meta.name}` : ""}
                  </div>
                </div>
                <div className={cn("ml-auto mt-1 h-2.5 w-2.5 rounded-full", highlighted ? "bg-foreground" : "bg-muted-foreground/30")} />
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
