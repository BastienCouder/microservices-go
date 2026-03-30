import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ModelCard } from "@/features/monitoring/_components/shared/model-card";
import {
  getCatalogDefaultSelection,
  loadModelCatalog,
} from "@/features/models/core/catalog-client";
import { readSelectedOrganizationId } from "@/features/models/core/model-access";
import { useOnboarding } from "@/hooks/use-onboarding";
import { appQueryKeys } from "@/lib/query-keys";

type StepModelsProps = {
  apiBaseURL: string;
  hideBack?: boolean;
  nextLabel?: string;
};

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function StepModels({
  apiBaseURL,
  hideBack = false,
  nextLabel = "Start audit",
}: StepModelsProps) {
  const { selectedModels, setSelectedModels, nextStep, prevStep } =
    useOnboarding();
  const [organizationId, setOrganizationId] = useState("");
  const [didApplyDefaults, setDidApplyDefaults] = useState(false);

  useEffect(() => {
    setOrganizationId(readSelectedOrganizationId());
  }, []);

  const catalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "active"),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadModelCatalog(apiBaseURL, organizationId, {
        activeOnly: true,
        signal,
      }),
  });

  const catalog = catalogQuery.data ?? [];
  const allowedModelIds = useMemo(
    () => new Set(catalog.map((model) => model.id)),
    [catalog],
  );

  useEffect(() => {
    if (selectedModels.length === 0) return;

    const filteredSelection = selectedModels.filter((modelId) =>
      allowedModelIds.has(modelId),
    );
    if (!sameStringArray(filteredSelection, selectedModels)) {
      setSelectedModels(filteredSelection);
    }
  }, [allowedModelIds, selectedModels, setSelectedModels]);

  useEffect(() => {
    if (didApplyDefaults || !catalogQuery.isSuccess) return;

    setDidApplyDefaults(true);
    if (selectedModels.length > 0) return;

    const defaultSelection = getCatalogDefaultSelection(catalog, 3);
    if (defaultSelection.length > 0) {
      setSelectedModels(defaultSelection);
    }
  }, [
    catalog,
    catalogQuery.isSuccess,
    didApplyDefaults,
    selectedModels.length,
    setSelectedModels,
  ]);

  const toggleModel = (modelId: string) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter((id) => id !== modelId));
      return;
    }

    setSelectedModels([...selectedModels, modelId]);
  };

  const selectableModels = catalog.filter((model) => model.isActive);
  const selectedCount = selectedModels.filter((modelId) =>
    allowedModelIds.has(modelId),
  ).length;
  const canContinue = selectedCount > 0 && selectableModels.length > 0;

  return (
    <div className="w-full min-h-[calc(100dvh-180px)] space-y-6 rounded-[32px] border border-white/70 bg-white/95 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur sm:min-h-0 sm:p-8">
      <div className="space-y-2">
        <h2 className="text-xl font-semibold tracking-[-0.02em] text-zinc-950 sm:text-3xl">
          AI models to monitor
        </h2>
        <p className="text-sm text-muted-foreground sm:text-base">
          Choose where you want to track your brand before the first analysis
          starts.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[24px] border border-border/70 bg-muted/20 px-4 py-3">
        <span className="text-sm font-medium text-foreground">
          {selectedCount} selected
        </span>
        <span className="text-sm text-muted-foreground">
          This list is synced from your shared model catalog.
        </span>
      </div>

      {!organizationId ? (
        <div className="rounded-[24px] border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
          Select an organization first to load its model catalog.
        </div>
      ) : catalogQuery.isLoading ? (
        <div className="rounded-[24px] border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
          Loading active models...
        </div>
      ) : catalogQuery.error instanceof Error ? (
        <div className="rounded-[24px] border border-dashed border-border/70 px-4 py-8 text-sm text-destructive">
          {catalogQuery.error.message}
        </div>
      ) : selectableModels.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-border/70 px-4 py-8 text-sm text-muted-foreground">
          No active model is available yet. Add one from the Models page.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {selectableModels.map((model) => {
            const selected = selectedModels.includes(model.id);

            return (
              <div key={model.id} className="relative">
                <span
                  className={[
                    "pointer-events-none absolute left-3 top-3 z-10 rounded-full px-2 py-0.5 text-[11px] font-medium",
                    model.supportsLiveSearch
                      ? "bg-primary/12 text-primary"
                      : "bg-zinc-900/6 text-zinc-600",
                  ].join(" ")}
                >
                  {model.supportsLiveSearch ? "Live" : "Chat"}
                </span>
                <ModelCard
                  name={model.name}
                  description={model.description}
                  icon={model.icon}
                  selected={selected}
                  onClick={() => toggleModel(model.id)}
                  modelGroup={model.modelGroup}
                  size="models"
                />
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border/70 pt-4">
        {hideBack ? (
          <div />
        ) : (
          <Button variant="outline" onClick={prevStep}>
            Back
          </Button>
        )}
        <Button
          className="min-w-36"
          onClick={nextStep}
          disabled={!canContinue}
        >
          {nextLabel}
        </Button>
      </div>
    </div>
  );
}
