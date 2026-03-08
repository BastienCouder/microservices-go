"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Save, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ModelCard } from "@/features/monitoring/_components/filters-panel/model-card";
import { PageHeader } from "@/features/shared/view/page-header";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";
import { gatewayJSON } from "@/shared/api/gateway";
import {
  getPlanLabel,
  getPlanLimit,
  normalizeStoredPlan,
  type ModelCatalogItem,
  type ModelsProjectSummary,
  SELECTED_ORG_KEY,
  SIM_PLAN_KEY_PREFIX,
  type SimulatedPlan,
} from "../core/model-access";

type ModelsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getField<T = unknown>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in obj) return obj[key] as T;
  }
  return undefined;
}

function unwrapSuccessEnvelope(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) {
    return value.data;
  }
  return value;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getBool(value: unknown): boolean {
  return value === true;
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function readProjectIdFromSearch(routeSearch: string): string {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  return (
    params.get("projectId") ||
    params.get("project_id") ||
    params.get("project") ||
    ""
  ).trim();
}

function readSelectedOrganizationId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SELECTED_ORG_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

function readSimulatedPlan(organizationId: string): SimulatedPlan {
  if (typeof window === "undefined" || !organizationId) return "starter";
  try {
    return normalizeStoredPlan(window.localStorage.getItem(`${SIM_PLAN_KEY_PREFIX}${organizationId}`));
  } catch {
    return "starter";
  }
}

function normalizeProjects(value: unknown): ModelsProjectSummary[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => ({
      id: getIDString(getField(entry, ["id", "ID"])),
      name: getString(getField(entry, ["name", "Name"])) || "Project",
      brandName: getString(getField(entry, ["brandName", "BrandName"])),
      status: getString(getField(entry, ["status", "Status"])),
    }))
    .filter((project) => project.id !== "");
}

function normalizeCatalog(value: unknown): ModelCatalogItem[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => {
      const name = getString(getField(entry, ["displayName", "DisplayName"])) || "AI model";
      const modelGroup = getString(getField(entry, ["groupName", "GroupName"])) || name;
      const provider = getString(getField(entry, ["provider", "Provider"]));
      const providerModelId = getString(getField(entry, ["providerModelId", "ProviderModelId"]));
      const supportsLiveSearch = getBool(getField(entry, ["supportsLiveSearch", "SupportsLiveSearch"]));

      return {
        id: getIDString(getField(entry, ["id", "ID"])),
        modelGroup,
        name,
        provider,
        providerModelId,
        description: supportsLiveSearch
          ? `${provider} · live search`
          : providerModelId || provider || "AI model",
        icon: toSafeImageAssetPath(getString(getField(entry, ["iconPath", "IconPath"]))),
        isActive: getBool(getField(entry, ["isActive", "IsActive"])),
        supportsLiveSearch,
      };
    })
    .filter((model) => model.id !== "");
}

function normalizeSelectedModelIds(value: unknown): string[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  return payload
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .filter((entry) => getBool(getField(entry, ["isEnabledForProject"])))
    .map((entry) => getIDString(getField(entry, ["id", "ID"])))
    .filter(Boolean);
}

async function loadProjectsAndCatalog(
  apiBaseURL: string,
  organizationId: string,
  signal?: AbortSignal,
): Promise<{ projects: ModelsProjectSummary[]; catalog: ModelCatalogItem[] }> {
  const [projectsResponse, catalogResponse] = await Promise.all([
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.list(), {
      method: "GET",
      organizationId,
      signal,
    }),
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.aiModels.list(true), {
      method: "GET",
      organizationId,
      signal,
    }),
  ]);

  if (!projectsResponse.ok) {
    throw new Error("Impossible de charger les projets pour cette organisation.");
  }
  if (!catalogResponse.ok) {
    throw new Error("Impossible de charger le catalogue des modeles.");
  }

  return {
    projects: normalizeProjects(projectsResponse.data),
    catalog: normalizeCatalog(catalogResponse.data),
  };
}

async function loadProjectModels(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.models(projectId), {
    method: "GET",
    organizationId,
    signal,
  });

  if (!response.ok) {
    throw new Error("Impossible de charger les modeles actifs du projet.");
  }

  return normalizeSelectedModelIds(response.data);
}

export function ModelsTemplate({ apiBaseURL, routeSearch }: ModelsTemplateProps) {
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const hintedProjectId = useMemo(() => readProjectIdFromSearch(routeSearch), [routeSearch]);

  const plan = useMemo(() => readSimulatedPlan(organizationId), [organizationId]);
  const projectsCatalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) => loadProjectsAndCatalog(apiBaseURL, organizationId, signal),
  });
  const projects = projectsCatalogQuery.data?.projects ?? [];
  const catalog = projectsCatalogQuery.data?.catalog ?? [];
  const planLabel = getPlanLabel(plan);
  const selectionLimit = getPlanLimit(plan, catalog.length);

  const projectModelsQuery = useQuery({
    queryKey: appQueryKeys.projectModels(apiBaseURL, organizationId, selectedProjectId),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "" && selectedProjectId !== "",
    queryFn: ({ signal }) => loadProjectModels(apiBaseURL, organizationId, selectedProjectId, signal),
  });

  const saveModelsMutation = useMutation({
    mutationFn: async (modelIds: string[]) => {
      const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.models(selectedProjectId), {
        method: "PATCH",
        organizationId,
        body: JSON.stringify({ modelIds: modelIds.slice(0, selectionLimit) }),
      });

      if (!response.ok) {
        throw new Error("Impossible de mettre a jour les modeles du projet.");
      }

      return modelIds.slice(0, selectionLimit);
    },
    onSuccess: async (nextModelIds) => {
      queryClient.setQueryData(
        appQueryKeys.projectModels(apiBaseURL, organizationId, selectedProjectId),
        nextModelIds,
      );
      await queryClient.invalidateQueries({
        queryKey: appQueryKeys.projectModels(apiBaseURL, organizationId, selectedProjectId),
      });
      setError(null);
      setMessage("Modeles du projet mis a jour.");
    },
    onError: (mutationError) => {
      setError(mutationError instanceof Error ? mutationError.message : "Impossible de mettre a jour les modeles du projet.");
    },
  });

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );
  const loading =
    projectsCatalogQuery.isLoading ||
    (projectsCatalogQuery.isFetching && !projectsCatalogQuery.data) ||
    (selectedProjectId !== "" &&
      (projectModelsQuery.isLoading || (projectModelsQuery.isFetching && !projectModelsQuery.data)));
  const saving = saveModelsMutation.isPending;

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
      (hintedProjectId && projects.some((project) => project.id === hintedProjectId) ? hintedProjectId : "") ||
      projects[0]?.id ||
      "";

    setSelectedProjectId((current) => (current === nextProjectId ? current : nextProjectId));
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
      [model.modelGroup, model.name, model.provider, model.providerModelId, model.description]
        .some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [catalog, search]);

  const toggleModel = (modelId: string) => {
    const isSelected = selectedModelIds.includes(modelId);

    if (isSelected) {
      setSelectedModelIds((current) => current.filter((value) => value !== modelId));
      setMessage(null);
      return;
    }

    if (selectedModelIds.length >= selectionLimit) {
      setMessage(`${planLabel} permet jusqu'a ${selectionLimit} modele${selectionLimit > 1 ? "s" : ""}.`);
      return;
    }

    setSelectedModelIds((current) => [...current, modelId]);
    setMessage(null);
  };

  const saveModels = async () => {
    if (!organizationId || !selectedProjectId || selectedModelIds.length === 0) {
      setError("Selectionne au moins un modele avant de sauvegarder.");
      return;
    }

    setError(null);
    setMessage(null);
    await saveModelsMutation.mutateAsync(selectedModelIds);
  };

  const activeCount = selectedModelIds.length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Models"
        baseline="Configure les modeles actifs d'un projet a partir du catalogue ai_models et de la table project_models."
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="default">{activeCount} selected</Badge>
            <Badge variant="outline">{planLabel}</Badge>
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={() => setSelectedModelIds([])}
              disabled={selectedModelIds.length === 0 || loading}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Clear
            </Button>
            <Button
              type="button"
              className="gap-2"
              onClick={() => void saveModels()}
              disabled={saving || loading || !selectedProject || selectedModelIds.length === 0}
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Saving..." : "Save models"}
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col rounded-md rounded-tr-none bg-background">
        <div className="border-b px-3 pb-3 pt-0 md:px-4 md:pb-4">
          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId} disabled={projects.length === 0}>
              <SelectTrigger className="h-10 w-full sm:h-8 sm:w-[240px]">
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent align="start">
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.brandName || project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Badge variant="outline" className="h-10 justify-center rounded-full px-4 text-xs sm:h-8">
              Org #{organizationId || "none"}
            </Badge>
            <Badge variant="outline" className="h-10 justify-center rounded-full px-4 text-xs sm:h-8">
              {selectedModelIds.length}/{selectionLimit || 0} models
            </Badge>
            {selectedProject ? (
              <Badge variant="outline" className="h-10 justify-center rounded-full px-4 text-xs sm:h-8">
                {selectedProject.status || "draft"}
              </Badge>
            ) : null}

            <div className="relative w-full min-w-0 sm:min-w-[260px] sm:flex-1 lg:max-w-[420px]">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-10 pl-9 sm:h-8"
                placeholder="Search in models"
              />
            </div>
          </div>
        </div>

        <div className="border-b px-4 py-3 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {selectedProject?.brandName || selectedProject?.name || "No project selected"}
              </p>
              <p className="text-sm text-muted-foreground">
                Selectionne les modeles que ce projet peut utiliser selon son plan.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{filteredCatalog.length} models</Badge>
            </div>
          </div>

          {error ? (
            <div className="mt-3 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {message ? (
            <div className="mt-3 rounded-lg border border-primary/15 bg-primary/5 px-4 py-3 text-sm text-primary">
              {message}
            </div>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
          {!organizationId ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
              Selectionne d&apos;abord une organisation pour configurer les modeles d&apos;un projet.
            </div>
          ) : loading ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
              Loading models...
            </div>
          ) : filteredCatalog.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
              No AI models available for this search.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {filteredCatalog.map((model) => {
                const isSelected = selectedModelIds.includes(model.id);
                const disabledByPlan = !isSelected && selectedModelIds.length >= selectionLimit;

                return (
                  <div key={model.id} className={disabledByPlan ? "opacity-70" : undefined}>
                    <ModelCard
                      name={model.name}
                      description={model.description}
                      icon={model.icon}
                      selected={isSelected}
                      onClick={() => toggleModel(model.id)}
                      modelGroup={model.modelGroup}
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
