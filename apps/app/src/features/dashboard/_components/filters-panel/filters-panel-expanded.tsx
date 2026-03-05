"use client";

import { ChevronDown, ChevronUp } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/dashboard/date-range-picker";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { useI18nScope } from "@/shared/hooks/use-i18n";
import { FiltersEmptyStateCard } from "./filters-empty-state-card";

type ModelItem = { id: string; name: string; description: string; icon: string; live: boolean };
type PersonaItem = { id: string; label: string };
type CompetitorItem = { name: string; sov: number; trend: string };
type Project = { name: string; tagline: string; competitors: CompetitorItem[] };

type FiltersPanelExpandedProps = {
  project: Project;
  period: string;
  setPeriod: (value: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (value: DateRange | undefined) => void;
  personaOptions: PersonaItem[];
  selectedPersonas: string[];
  togglePersona: (id: string) => void;
  clearPersonas: () => void;
  models: ModelItem[];
  selectedModels: string[];
  toggleModel: (id: string) => void;
  clearModels: () => void;
  selectedCompetitors: string[];
  toggleCompetitor: (name: string) => void;
  clearCompetitors: () => void;
  showAllModels: boolean;
  setShowAllModels: (value: boolean) => void;
  showAllPersonas: boolean;
  setShowAllPersonas: (value: boolean) => void;
  showAllCompetitors: boolean;
  setShowAllCompetitors: (value: boolean) => void;
  onResetFilters: () => void;
  showResetFilters: boolean;
  showUniqueModelFilters: boolean;
  onToggleModelFilterMode: () => void;
};

const COMPETITORS_COUNT = 3;
const MODELS_COUNT = 4;
const PERSONAS_COUNT = 4;

export function FiltersPanelExpanded(props: FiltersPanelExpandedProps) {
  const content = useI18nScope("dashboard-filters-panel");
  const filteredModels = props.models.filter((model) => model.live);
  const visibleModels = props.showAllModels ? filteredModels : filteredModels.slice(0, MODELS_COUNT);
  const visiblePersonas = props.showAllPersonas ? props.personaOptions : props.personaOptions.slice(0, PERSONAS_COUNT);
  const visibleCompetitors = props.showAllCompetitors
    ? props.project.competitors
    : props.project.competitors.slice(0, COMPETITORS_COUNT);

  return (
    <div className="flex h-auto flex-col xl:h-full">
      <div className="min-h-0 flex-1 overflow-y-auto p-2 no-scrollbar">
        <div className="flex flex-col gap-5 pb-4">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 text-sm font-semibold text-foreground">{content.filters}</h4>
              {props.showResetFilters ? (
                <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px]" onClick={props.onResetFilters}>
                  {content.resetFilters}
                </Button>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{content.period}</Label>
              <DatePickerWithRange
                date={props.dateRange}
                setDate={props.setDateRange}
                period={props.period}
                setPeriod={props.setPeriod}
              />
            </div>

            {props.personaOptions.length > 0 ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label className="text-xs text-muted-foreground">{content.personas}</Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn("h-6 px-2 text-[10px]", props.selectedPersonas.length === 0 && "invisible pointer-events-none")}
                    onClick={props.clearPersonas}
                  >
                    {content.clearPersonas}
                  </Button>
                </div>

                <div className="space-y-2">
                  {visiblePersonas.map((persona) => {
                    const isSelected = props.selectedPersonas.includes(persona.id);
                    return (
                      <label
                        key={persona.id}
                        className={cn(
                          "flex cursor-pointer items-start gap-3 rounded-md border border-dashed px-3 py-2",
                          isSelected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/30",
                        )}
                      >
                        <Checkbox checked={isSelected} onCheckedChange={() => props.togglePersona(persona.id)} />
                        <span className="min-w-0 break-words text-sm leading-tight">{persona.label}</span>
                      </label>
                    );
                  })}
                </div>

                {props.personaOptions.length > PERSONAS_COUNT ? (
                  <ToggleMoreButton
                    showAll={props.showAllPersonas}
                    hiddenCount={props.personaOptions.length - PERSONAS_COUNT}
                    onToggle={() => props.setShowAllPersonas(!props.showAllPersonas)}
                  />
                ) : null}
              </div>
            ) : null}

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground">{content.models}</Label>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn("h-6 px-2 text-[10px]", props.selectedModels.length === 0 && "invisible pointer-events-none")}
                    onClick={props.clearModels}
                  >
                    {content.clear}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px]"
                    onClick={props.onToggleModelFilterMode}
                  >
                    {props.showUniqueModelFilters ? "Regrouper" : "Modeles uniques"}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                {visibleModels.map((model) => {
                  const isSelected = props.selectedModels.includes(model.id);
                  return (
                    <label
                      key={model.id}
                      className={cn(
                        "flex cursor-pointer items-start gap-3 rounded-md border border-dashed px-3 py-2",
                        isSelected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/30",
                      )}
                    >
                      <Checkbox checked={isSelected} onCheckedChange={() => props.toggleModel(model.id)} />
                      {model.icon ? (
                        <img
                          src={model.icon}
                          alt={model.name}
                          width={18}
                          height={18}
                          loading="lazy"
                          className="mt-0.5 h-4.5 w-4.5 object-contain"
                        />
                      ) : null}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{model.name}</p>
                        {model.description ? (
                          <p className="line-clamp-2 text-[11px] text-muted-foreground">{model.description}</p>
                        ) : null}
                      </div>
                    </label>
                  );
                })}
              </div>

              {filteredModels.length === 0 ? (
                <FiltersEmptyStateCard label={content.noDataAvailable} />
              ) : null}
              {filteredModels.length > MODELS_COUNT ? (
                <ToggleMoreButton
                  showAll={props.showAllModels}
                  hiddenCount={filteredModels.length - MODELS_COUNT}
                  onToggle={() => props.setShowAllModels(!props.showAllModels)}
                />
              ) : null}
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 text-sm font-semibold leading-tight text-foreground">{content.topCompetitors}</h4>
              <Button
                variant="ghost"
                size="sm"
                className={cn("text-xs", props.selectedCompetitors.length === 0 && "invisible pointer-events-none")}
                onClick={props.clearCompetitors}
              >
                {content.clearCompetitors}
              </Button>
            </div>

            <div className="space-y-2">
              {visibleCompetitors.map((competitor) => {
                const isSelected = props.selectedCompetitors.includes(competitor.name);
                return (
                  <label
                    key={competitor.name}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-md border border-dashed px-3 py-2",
                      isSelected ? "border-primary bg-primary/5" : "border-border/60 hover:bg-muted/30",
                    )}
                  >
                    <Checkbox checked={isSelected} onCheckedChange={() => props.toggleCompetitor(competitor.name)} />
                    <span className="min-w-0 flex-1 truncate text-sm">{competitor.name}</span>
                    <span className="text-[11px] tabular-nums text-muted-foreground">{competitor.sov.toFixed(1)}%</span>
                  </label>
                );
              })}
            </div>

            {props.project.competitors.length === 0 ? (
              <FiltersEmptyStateCard label={content.noDataAvailable} />
            ) : null}
            {props.project.competitors.length > COMPETITORS_COUNT ? (
              <ToggleMoreButton
                showAll={props.showAllCompetitors}
                hiddenCount={props.project.competitors.length - COMPETITORS_COUNT}
                onToggle={() => props.setShowAllCompetitors(!props.showAllCompetitors)}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleMoreButton({
  showAll,
  hiddenCount,
  onToggle,
}: {
  showAll: boolean;
  hiddenCount: number;
  onToggle: () => void;
}) {
  const content = useI18nScope("dashboard-filters-panel");

  return (
    <Button
      variant="ghost"
      className="mt-1 h-auto min-h-7 w-full whitespace-normal py-1 text-xs leading-tight text-muted-foreground hover:text-foreground"
      onClick={onToggle}
    >
      {showAll ? (
        <>
          {content.showLess} <ChevronUp className="ml-1 h-3 w-3" />
        </>
      ) : (
        <>
          {content.showMore} ({hiddenCount}) <ChevronDown className="ml-1 h-3 w-3" />
        </>
      )}
    </Button>
  );
}
