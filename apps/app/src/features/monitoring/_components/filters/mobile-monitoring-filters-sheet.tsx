"use client";

import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";

import { ModelFilterModeTabs } from "@/components/monitoring/model-filter-mode-tabs";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { FiltersEmptyStateCard } from "../shared/filters-empty-state-card";
import { ModelCard } from "../shared/model-card";

type MobileMonitoringFiltersSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showResetFilters: boolean;
  onResetFilters: () => void;
  personaOptions: Array<{ id: string; label: string }>;
  selectedPersonas: string[];
  togglePersona: (id: string) => void;
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
  selectedCompetitors: string[];
  toggleCompetitor: (name: string) => void;
  project: {
    competitors: Array<{ name: string; sov: number }>;
  };
  showUniqueModelFilters: boolean;
  onModelFilterModeChange: (value: boolean) => void;
};

export function MobileMonitoringFiltersSheet({
  open,
  onOpenChange,
  showResetFilters,
  onResetFilters,
  personaOptions,
  selectedPersonas,
  togglePersona,
  models,
  selectedModels,
  toggleModel,
  selectedCompetitors,
  toggleCompetitor,
  project,
  showUniqueModelFilters,
  onModelFilterModeChange,
}: MobileMonitoringFiltersSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="h-[88vh] max-h-[88vh] gap-0 overflow-hidden rounded-t-[32px] border-none bg-[#f8f7f3] p-0">
        <DrawerHeader className="border-b border-slate-200/80 px-5 pb-4 pt-2 text-left">
          <DrawerTitle className="flex items-center gap-2 text-lg font-semibold text-slate-950">
            <Sparkles className="h-4 w-4 text-primary" />
            Filtres monitoring
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed text-slate-500">
            Ajustez la lecture du monitoring avec des sélections rapides, pensées pour le mobile.
          </DrawerDescription>
        </DrawerHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <div className="space-y-6">
            <section className="space-y-3 rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
              <SectionHeader title="Persona" count={selectedPersonas.length} />
              {personaOptions.length === 0 ? (
                <FiltersEmptyStateCard label="Aucun persona disponible." className="h-[120px]" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {personaOptions.map((persona) => (
                    <FilterPill
                      key={persona.id}
                      selected={selectedPersonas.includes(persona.id)}
                      onClick={() => togglePersona(persona.id)}
                    >
                      {persona.label}
                    </FilterPill>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-4 rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
              <SectionHeader title="Modèles IA" count={selectedModels.length} />
              <ModelFilterModeTabs
                value={showUniqueModelFilters ? "unique" : "grouped"}
                onValueChange={(value) => onModelFilterModeChange(value === "unique")}
                listClassName="h-10 w-full rounded-2xl bg-slate-100"
              />
              {models.length === 0 ? (
                <FiltersEmptyStateCard label="Aucun modèle disponible." className="h-[120px]" />
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {models.map((model) => (
                    <ModelCard
                      key={model.id}
                      name={model.name}
                      description={model.description}
                      icon={model.icon}
                      selected={selectedModels.includes(model.id)}
                      onClick={() => toggleModel(model.id)}
                      modelGroup={model.modelGroup}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3 rounded-[28px] border border-slate-200/80 bg-white p-4 shadow-sm">
              <SectionHeader title="Concurrents" count={selectedCompetitors.length} />
              {project.competitors.length === 0 ? (
                <FiltersEmptyStateCard label="Aucun concurrent disponible." className="h-[120px]" />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {project.competitors.map((competitor) => (
                    <FilterPill
                      key={competitor.name}
                      selected={selectedCompetitors.includes(competitor.name)}
                      onClick={() => toggleCompetitor(competitor.name)}
                      trailing={`${competitor.sov.toFixed(0)}%`}
                    >
                      {competitor.name}
                    </FilterPill>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>

        <DrawerFooter className="border-t border-slate-200/80 bg-white px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <div className="grid grid-cols-2 gap-3">
            <Button
              type="button"
              variant="outline"
              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
              onClick={onResetFilters}
              disabled={!showResetFilters}
            >
              Réinitialiser
            </Button>
            <Button
              type="button"
              className="h-12 rounded-2xl"
              onClick={() => onOpenChange(false)}
            >
              Fermer
            </Button>
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

function SectionHeader({
  title,
  count,
}: {
  title: string;
  count: number;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-base font-semibold text-slate-950">{title}</p>
        <p className="text-xs text-slate-500">Sélection tactile, application immédiate.</p>
      </div>
      <div className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
        {count}
      </div>
    </div>
  );
}

function FilterPill({
  children,
  selected,
  onClick,
  trailing,
}: {
  children: ReactNode;
  selected: boolean;
  onClick: () => void;
  trailing?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-all",
        selected
          ? "border-primary bg-primary text-primary-foreground shadow-[0_14px_32px_-24px_hsl(var(--primary)/0.85)]"
          : "border-slate-200 bg-slate-50 text-slate-700",
      )}
      aria-pressed={selected}
    >
      <span>{children}</span>
      {trailing ? (
        <span className={cn("text-[11px]", selected ? "text-primary-foreground/80" : "text-slate-500")}>
          {trailing}
        </span>
      ) : null}
    </button>
  );
}
