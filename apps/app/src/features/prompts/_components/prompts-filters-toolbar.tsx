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
  modelsPopoverOpen,
  setModelsPopoverOpen,
  allModelsSelected,
  selectedModels,
  availableModels,
  getModelVisual,
  toggleModel,
}: PromptsFiltersToolbarProps) {
  return (
      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="relative w-full min-w-0 sm:min-w-[260px] sm:flex-1 lg:max-w-[480px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="h-10 pl-9 sm:h-8"
            placeholder="Search in prompts"
          />
        </div>


        <DatePickerWithRange
          className="w-full sm:w-[220px]"
          date={dateRange}
          setDate={setDateRange}
          period={period}
          setPeriod={setPeriod}
        />

        {availablePersonas.length > 0 ? (
          <Select value={persona} onValueChange={setPersona}>
            <SelectTrigger className="h-10 w-full sm:h-8 sm:w-[160px]">
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
        ) : null}

        <ModelsFilterPopover
          open={modelsPopoverOpen}
          onOpenChange={setModelsPopoverOpen}
          allModelsSelected={allModelsSelected}
          selectedModels={selectedModels}
          availableModels={availableModels}
          getModelVisual={getModelVisual}
          toggleModel={toggleModel}
        />

      
        {hasActiveGlobalFilters && (
          <Button size="sm" variant="ghost" className="h-10 justify-center rounded-full px-4 text-xs sm:h-8" onClick={clearFilters}>
            Clear all
          </Button>
        )}
      </div>
  );
}
