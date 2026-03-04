"use client";

import { DateRange } from "react-day-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePickerWithRange } from "@/components/dashboard/date-range-picker";
import { Search } from "lucide-react";
import { ModelsFilterPopover } from "./models-filter-popover";

type ModelVisual = {
  icon: string;
  description: string;
  label: string;
};

type PromptsFiltersToolbarProps = {
  period: string;
  setPeriod: (period: string) => void;
  dateRange: DateRange | undefined;
  setDateRange: (range: DateRange | undefined) => void;
  persona: string;
  setPersona: (persona: string) => void;
  availablePersonas: string[];
  search: string;
  setSearch: (value: string) => void;
  hasActiveGlobalFilters: boolean;
  clearFilters: () => void;
  activeStages: string[];
  stages: string[];
  toggleStage: (stage: string) => void;
  modelsPopoverOpen: boolean;
  setModelsPopoverOpen: (open: boolean) => void;
  allModelsSelected: boolean;
  selectedModels: string[];
  availableModels: string[];
  getModelVisual: (model: string) => ModelVisual;
  toggleModel: (model: string) => void;
};

export function PromptsFiltersToolbar({
  period,
  setPeriod,
  dateRange,
  setDateRange,
  persona,
  setPersona,
  availablePersonas,
  search,
  setSearch,
  hasActiveGlobalFilters,
  clearFilters,
  activeStages,
  stages,
  toggleStage,
  modelsPopoverOpen,
  setModelsPopoverOpen,
  allModelsSelected,
  selectedModels,
  availableModels,
  getModelVisual,
  toggleModel,
}: PromptsFiltersToolbarProps) {
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <DatePickerWithRange
          className="w-[220px]"
          date={dateRange}
          setDate={setDateRange}
          period={period}
          setPeriod={setPeriod}
        />

        <Select value={persona} onValueChange={setPersona}>
          <SelectTrigger className="h-8 w-[150px]">
            <SelectValue placeholder="Persona" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All personas</SelectItem>
            {availablePersonas.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <ModelsFilterPopover
          open={modelsPopoverOpen}
          onOpenChange={setModelsPopoverOpen}
          allModelsSelected={allModelsSelected}
          selectedModels={selectedModels}
          availableModels={availableModels}
          getModelVisual={getModelVisual}
          toggleModel={toggleModel}
        />

        <div className="relative w-96">
          <Search className="absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-8 pl-8"
            placeholder="Search in prompts"
          />
        </div>

        {hasActiveGlobalFilters && (
          <Button size="sm" variant="ghost" className="h-8 px-2 text-xs" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {stages.map((item) => (
          <Button
            key={item}
            type="button"
            size="sm"
            variant={activeStages.includes(item) ? "default" : "outline"}
            className="h-7 px-2 text-xs"
            onClick={() => toggleStage(item)}
          >
            {item}
          </Button>
        ))}
      </div>
    </>
  );
}
