import { ModelFilterModeTabs } from "@/components/shared/model-filter-mode-tabs";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { ToggleMoreButton } from "./toggle-more-button";
import { ModelCard } from "@/components/shared/model-card";

const MODELS_COUNT = 4;

type ModelFilterSectionProps = {
  models: Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    live: boolean;
    modelGroup: string;
  }>;
  selectedModels: string[];
  toggleModel: (id: string) => void;
  clearModels: () => void;
  showAllModels: boolean;
  setShowAllModels: (value: boolean) => void;
  showUniqueModelFilters: boolean;
  onModelFilterModeChange: (value: boolean) => void;
};

export function ModelFilterSection({
  models,
  selectedModels,
  toggleModel,
  clearModels,
  showAllModels,
  setShowAllModels,
  showUniqueModelFilters,
  onModelFilterModeChange,
}: ModelFilterSectionProps) {
  const content = useI18nScope("monitoring-filters-panel");
  const filteredModels = models.filter((model) => model.live);
  const visibleModels = showAllModels
    ? filteredModels
    : filteredModels.slice(0, MODELS_COUNT);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground md:text-sm lg:text-xs">
          {content.models}
        </Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 min-w-[4.75rem] justify-center px-3 text-xs lg:h-6 lg:min-w-[4rem] lg:px-2 lg:text-xs",
            selectedModels.length === 0 && "invisible pointer-events-none",
          )}
          onClick={clearModels}
        >
          {content.clear}
        </Button>
      </div>

      <ModelFilterModeTabs
        value={showUniqueModelFilters ? "unique" : "grouped"}
        onValueChange={(value) => onModelFilterModeChange(value === "unique")}
        listClassName="h-8 w-full"
      />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {visibleModels.map((model) => {
          const isSelected = selectedModels.includes(model.id);

          return (
            <ModelCard
              key={model.id}
              name={model.name}
              description={model.description}
              icon={model.icon}
              selected={isSelected}
              onClick={() => toggleModel(model.id)}
              modelGroup={model.modelGroup}
            />
          );
        })}
      </div>

      {filteredModels.length === 0 ? (
        <EmptyStateCard label={content.noDataAvailable} />
      ) : null}
      {filteredModels.length > MODELS_COUNT ? (
        <ToggleMoreButton
          showAll={showAllModels}
          hiddenCount={filteredModels.length - MODELS_COUNT}
          onToggle={() => setShowAllModels(!showAllModels)}
        />
      ) : null}
    </div>
  );
}
