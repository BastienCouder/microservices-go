"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ModelCard } from "@/features/monitoring/_components/shared/model-card";
import {
  loadProjectModels,
  loadProjectsAndCatalog,
} from "@/features/models/core/catalog-client";
import { PageHeader } from "@/features/shared/view/page-header";
import { appQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  getPlanLabel,
  getPlanLimit,
  normalizeStoredPlan,
  readSelectedOrganizationId,
  SIM_PLAN_KEY_PREFIX,
  type SimulatedPlan,
} from "../core/model-access";

type ModelsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

function readProjectIdFromSearch(routeSearch: string): string {
  const normalized = routeSearch.startsWith("?")
    ? routeSearch.slice(1)
    : routeSearch;
  const params = new URLSearchParams(normalized);
  return (
    params.get("projectId") ||
    params.get("project_id") ||
    params.get("project") ||
    ""
  ).trim();
}

function readSimulatedPlan(organizationId: string): SimulatedPlan {
  if (typeof window === "undefined" || !organizationId) return "starter";
  try {
    return normalizeStoredPlan(
      window.localStorage.getItem(`${SIM_PLAN_KEY_PREFIX}${organizationId}`),
    );
  } catch {
    return "starter";
  }
}

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

export function ModelsTemplate({
  apiBaseURL,
  routeSearch,
}: ModelsTemplateProps) {
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hintedProjectId = useMemo(
    () => readProjectIdFromSearch(routeSearch),
    [routeSearch],
  );

  const plan = useMemo(
    () => readSimulatedPlan(organizationId),
    [organizationId],
  );
  const planLabel = getPlanLabel(plan);

  const projectsCatalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadProjectsAndCatalog(apiBaseURL, organizationId, { signal }),
  });

  const projects = projectsCatalogQuery.data?.projects ?? [];
  const catalog = projectsCatalogQuery.data?.catalog ?? [];
  const activeCatalogIDs = useMemo(
    () => new Set(catalog.map((model) => model.id)),
    [catalog],
  );
  const selectionLimit = getPlanLimit(plan, catalog.length);

  const projectModelsQuery = useQuery({
    queryKey: appQueryKeys.projectModels(
      apiBaseURL,
      organizationId,
      selectedProjectId,
    ),
    enabled:
      apiBaseURL.trim() !== "" &&
      organizationId !== "" &&
      selectedProjectId !== "",
    queryFn: ({ signal }) =>
      loadProjectModels(apiBaseURL, organizationId, selectedProjectId, signal),
  });

  const saveModelsMutation = useMutation({
    mutationFn: async (modelIds: string[]) => {
      const response = await fetch(
        `${apiBaseURL.replace(/\/$/, "")}/projects/${selectedProjectId}/models`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Organization-ID": organizationId,
          },
          body: JSON.stringify({
            modelIds: modelIds.slice(0, selectionLimit),
          }),
          credentials: "include",
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(
          payload?.error || "Impossible de mettre a jour les modeles du projet.",
        );
      }

      return modelIds.slice(0, selectionLimit);
    },
    onSuccess: async (nextModelIds) => {
      queryClient.setQueryData(
        appQueryKeys.projectModels(apiBaseURL, organizationId, selectedProjectId),
        nextModelIds,
      );
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.projectModels(
          apiBaseURL,
          organizationId,
          selectedProjectId,
        ),
      });
      setError(null);
      setMessage("Modeles du projet mis a jour.");
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de mettre a jour les modeles du projet.",
      );
    },
  });

  const loading =
    projectsCatalogQuery.isLoading ||
    (projectsCatalogQuery.isFetching && !projectsCatalogQuery.data) ||
    (selectedProjectId !== "" &&
      (projectModelsQuery.isLoading ||
        (projectModelsQuery.isFetching && !projectModelsQuery.data)));

  useEffect(() => {
    setOrganizationId(readSelectedOrganizationId());
  }, []);

  useEffect(() => {
    if (!organizationId) {
      setSelectedProjectId("");
      setSelectedModelIds([]);
      return;
    }

    const nextProjectId =
      ((hintedProjectId &&
        projects.some((project) => project.id === hintedProjectId) &&
        hintedProjectId) ||
        projects[0]?.id ||
        "");

    setSelectedProjectId((current) =>
      current === nextProjectId ? current : nextProjectId,
    );
  }, [hintedProjectId, organizationId, projects]);

  useEffect(() => {
    if (!selectedProjectId) {
      setSelectedModelIds([]);
      return;
    }

    if (projectModelsQuery.data) {
      setSelectedModelIds(projectModelsQuery.data);
    }
  }, [projectModelsQuery.data, selectedProjectId]);

  useEffect(() => {
    if (selectedModelIds.length === 0) return;

    const filteredSelection = selectedModelIds.filter((modelId) =>
      activeCatalogIDs.has(modelId),
    );
    if (!sameStringArray(filteredSelection, selectedModelIds)) {
      setSelectedModelIds(filteredSelection);
    }
  }, [activeCatalogIDs, selectedModelIds]);

  useEffect(() => {
    if (projectsCatalogQuery.error instanceof Error) {
      setError(projectsCatalogQuery.error.message);
      return;
    }
    if (projectModelsQuery.error instanceof Error) {
      setError(projectModelsQuery.error.message);
      return;
    }
    setError(null);
  }, [projectModelsQuery.error, projectsCatalogQuery.error]);

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) return catalog;

    return catalog.filter((model) =>
      [
        model.modelGroup,
        model.name,
        model.provider,
        model.providerModelId,
        model.description,
      ].some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [catalog, search]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );

  const toggleProjectModel = (modelId: string) => {
    const isSelected = selectedModelIds.includes(modelId);

    if (isSelected) {
      setSelectedModelIds((current) =>
        current.filter((value) => value !== modelId),
      );
      setMessage(null);
      return;
    }

    if (selectedModelIds.length >= selectionLimit) {
      setMessage(
        `${planLabel} permet jusqu'a ${selectionLimit} modele${
          selectionLimit > 1 ? "s" : ""
        }.`,
      );
      return;
    }

    setSelectedModelIds((current) => [...current, modelId]);
    setMessage(null);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Modeles"
        baseline="Choisissez directement les modeles actifs pour le projet."
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="default">{selectedModelIds.length} selectionnes</Badge>
            <Badge variant="outline" className="capitalize">
              plan {planLabel}
            </Badge>
          </>
        }
        actions={
          <Button
            type="button"
            onClick={() => void saveModelsMutation.mutateAsync(selectedModelIds)}
            disabled={
              saveModelsMutation.isPending ||
              loading ||
              !selectedProject ||
              selectedModelIds.length === 0
            }
          >
            {saveModelsMutation.isPending ? "Enregistrement..." : "Enregistrer"}
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col rounded-md rounded-tr-none bg-background">
        {(error || message) && (
          <div className="border-b px-4 py-3 md:px-6">
            {error ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            ) : null}
            {!error && message ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-foreground">
                {message}
              </div>
            ) : null}
          </div>
        )}

        <div className="border-b px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {selectedProject?.brandName ||
                  selectedProject?.name ||
                  "Aucun projet selectionne"}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedModelIds.length}/{selectionLimit || 0} modeles actifs
              </p>
            </div>

              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un modele"
                className="max-w-96"
              />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {!organizationId ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
              Selectionne d&apos;abord une organisation.
            </div>
          ) : loading ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
              Chargement des modeles...
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
              Aucun modele disponible.
            </div>
          ) : (
            <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-stretch gap-4">
              {filteredCatalog.map((model) => {
                const isSelected = selectedModelIds.includes(model.id);
                const disabledByPlan =
                  !isSelected && selectedModelIds.length >= selectionLimit;

                return (
                  <div
                    key={model.id}
                    className={cn("h-full min-w-0", disabledByPlan && "opacity-70")}
                  >
                    <ModelCard
                      name={model.name}
                      description={model.description}
                      icon={model.icon}
                      selected={isSelected}
                      onClick={() => toggleProjectModel(model.id)}
                      modelGroup={model.modelGroup}
                      size="models"
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ModelsTemplate;
