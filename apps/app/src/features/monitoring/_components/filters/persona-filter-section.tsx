import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";

import { ToggleMoreButton } from "./toggle-more-button";

const PERSONAS_COUNT = 4;

type PersonaFilterSectionProps = {
  personaOptions: Array<{ id: string; label: string }>;
  selectedPersonas: string[];
  togglePersona: (id: string) => void;
  clearPersonas: () => void;
  showAllPersonas: boolean;
  setShowAllPersonas: (value: boolean) => void;
};

export function PersonaFilterSection({
  personaOptions,
  selectedPersonas,
  togglePersona,
  clearPersonas,
  showAllPersonas,
  setShowAllPersonas,
}: PersonaFilterSectionProps) {
  const content = useI18nScope("monitoring-filters-panel");
  const visiblePersonas = showAllPersonas
    ? personaOptions
    : personaOptions.slice(0, PERSONAS_COUNT);

  if (personaOptions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs text-muted-foreground md:text-sm lg:text-xs">
          {content.personas}
        </Label>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 min-w-[5.5rem] justify-center px-3 text-xs lg:h-6 lg:min-w-[4.5rem] lg:px-2 lg:text-[10px]",
            selectedPersonas.length === 0 && "invisible pointer-events-none",
          )}
          onClick={clearPersonas}
        >
          {content.clearPersonas}
        </Button>
      </div>

      <div className="space-y-2">
        {visiblePersonas.map((persona) => {
          const isSelected = selectedPersonas.includes(persona.id);

          return (
            <label
              key={persona.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-md border border-dashed px-3 py-3 lg:py-2",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:bg-muted/30",
              )}
            >
              <Checkbox checked={isSelected} onCheckedChange={() => togglePersona(persona.id)} />
              <span className="min-w-0 break-words text-sm leading-tight md:text-[15px] lg:text-sm">
                {persona.label}
              </span>
            </label>
          );
        })}
      </div>

      {personaOptions.length > PERSONAS_COUNT ? (
        <ToggleMoreButton
          showAll={showAllPersonas}
          hiddenCount={personaOptions.length - PERSONAS_COUNT}
          onToggle={() => setShowAllPersonas(!showAllPersonas)}
        />
      ) : null}
    </div>
  );
}
