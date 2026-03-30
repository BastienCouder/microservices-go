"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ModelCard } from "@/features/monitoring/_components/shared/model-card";
import {
  createCatalogModel,
  loadProjectModels,
  loadProjectsAndCatalog,
  updateCatalogModel,
} from "@/features/models/core/catalog-client";
import { PageHeader } from "@/features/shared/view/page-header";
import { appQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import {
  getPlanLabel,
  getPlanLimit,
  normalizeStoredPlan,
  readSelectedOrganizationId,
  type CatalogModelPayload,
  type CatalogModelUpdatePayload,
  type ModelCatalogItem,
  SIM_PLAN_KEY_PREFIX,
  type SimulatedPlan,
} from "../core/model-access";

type ModelsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type CatalogDialogState = CatalogModelPayload;

function emptyCatalogDraft(): CatalogDialogState {
  return {
    id: "",
    displayName: "",
    provider: "",
    groupName: "",
    iconKey: "",
    providerModelId: "",
    isActive: true,
    supportsLiveSearch: false,
  };
}

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

function normalizeCatalogDraft(
  draft: CatalogDialogState,
): CatalogModelPayload | null {
  const payload: CatalogModelPayload = {
    id: draft.id.trim(),
    displayName: draft.displayName.trim(),
    provider: draft.provider.trim(),
    groupName: draft.groupName.trim(),
    iconKey: draft.iconKey.trim(),
    providerModelId: draft.providerModelId.trim(),
    isActive: draft.isActive,
    supportsLiveSearch: draft.supportsLiveSearch,
  };

  if (
    !payload.id ||
    !payload.displayName ||
    !payload.provider ||
    !payload.groupName ||
    !payload.iconKey ||
    !payload.providerModelId
  ) {
    return null;
  }

  return payload;
}

function buildUpdatePayload(
  payload: CatalogModelPayload,
): CatalogModelUpdatePayload {
  return {
    displayName: payload.displayName,
    provider: payload.provider,
    groupName: payload.groupName,
    iconKey: payload.iconKey,
    providerModelId: payload.providerModelId,
    isActive: payload.isActive,
    supportsLiveSearch: payload.supportsLiveSearch,
  };
}

function toCatalogDraft(model: ModelCatalogItem): CatalogDialogState {
  return {
    id: model.id,
    displayName: model.name,
    provider: model.provider,
    groupName: model.modelGroup,
    iconKey: model.iconKey,
    providerModelId: model.providerModelId,
    isActive: model.isActive,
    supportsLiveSearch: model.supportsLiveSearch,
  };
}

export function ModelsTemplate({ apiBaseURL, routeSearch }: ModelsTemplateProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("project");
  const [organizationId, setOrganizationId] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [projectSearch, setProjectSearch] = useState("");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [catalogDraft, setCatalogDraft] = useState<CatalogDialogState>(
    emptyCatalogDraft(),
  );
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
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
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "all"),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadProjectsAndCatalog(apiBaseURL, organizationId, {
        activeOnly: false,
        signal,
      }),
  });

  const projects = projectsCatalogQuery.data?.projects ?? [];
  const catalog = projectsCatalogQuery.data?.catalog ?? [];
  const activeCatalog = useMemo(
    () => catalog.filter((model) => model.isActive),
    [catalog],
  );
  const activeCatalogIDs = useMemo(
    () => new Set(activeCatalog.map((model) => model.id)),
    [activeCatalog],
  );
  const selectionLimit = getPlanLimit(plan, activeCatalog.length);

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

  const saveCatalogMutation = useMutation({
    mutationFn: async (draft: CatalogDialogState) => {
      const payload = normalizeCatalogDraft(draft);
      if (!payload) {
        throw new Error("Tous les champs du modele sont obligatoires.");
      }

      if (editingModelId) {
        return updateCatalogModel(
          apiBaseURL,
          organizationId,
          editingModelId,
          buildUpdatePayload(payload),
        );
      }

      return createCatalogModel(apiBaseURL, organizationId, payload);
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["models", "catalog", apiBaseURL, organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["models", "project", apiBaseURL, organizationId],
        }),
      ]);
      setCatalogDialogOpen(false);
      setCatalogDraft(emptyCatalogDraft());
      setEditingModelId(null);
      setError(null);
      setMessage(
        editingModelId ? "Modele mis a jour." : "Modele cree dans le catalogue.",
      );
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de mettre a jour le catalogue.",
      );
    },
  });

  const toggleCatalogMutation = useMutation({
    mutationFn: async ({
      modelId,
      isActive,
    }: {
      modelId: string;
      isActive: boolean;
    }) =>
      updateCatalogModel(apiBaseURL, organizationId, modelId, {
        isActive,
      }),
    onSuccess: async (updatedModel) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ["models", "catalog", apiBaseURL, organizationId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["models", "project", apiBaseURL, organizationId],
        }),
      ]);
      setError(null);
      setMessage(
        updatedModel.isActive
          ? "Modele reactive dans le catalogue."
          : "Modele desactive dans le catalogue.",
      );
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de mettre a jour le statut du modele.",
      );
    },
  });

  const loading =
    projectsCatalogQuery.isLoading ||
    (projectsCatalogQuery.isFetching && !projectsCatalogQuery.data) ||
    (selectedProjectId !== "" &&
      (projectModelsQuery.isLoading ||
        (projectModelsQuery.isFetching && !projectModelsQuery.data)));
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

  const filteredProjectCatalog = useMemo(() => {
    const normalizedSearch = projectSearch.trim().toLowerCase();
    if (!normalizedSearch) return activeCatalog;

    return activeCatalog.filter((model) =>
      [
        model.modelGroup,
        model.name,
        model.provider,
        model.providerModelId,
        model.description,
      ].some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [activeCatalog, projectSearch]);

  const filteredAdminCatalog = useMemo(() => {
    const normalizedSearch = catalogSearch.trim().toLowerCase();
    if (!normalizedSearch) return catalog;

    return catalog.filter((model) =>
      [
        model.id,
        model.modelGroup,
        model.name,
        model.provider,
        model.providerModelId,
        model.iconKey,
      ].some((value) => value.toLowerCase().includes(normalizedSearch)),
    );
  }, [catalog, catalogSearch]);

  const selectedProject = useMemo(
    () =>
      projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );
  const activeCount = selectedModelIds.filter((modelId) =>
    activeCatalogIDs.has(modelId),
  ).length;

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

  const saveModels = async () => {
    if (!organizationId || !selectedProjectId || selectedModelIds.length === 0) {
      setError("Selectionne au moins un modele avant de sauvegarder.");
      return;
    }

    setError(null);
    setMessage(null);
    await saveModelsMutation.mutateAsync(selectedModelIds);
  };

  const openCreateDialog = () => {
    setEditingModelId(null);
    setCatalogDraft(emptyCatalogDraft());
    setCatalogDialogOpen(true);
    setError(null);
  };

  const openEditDialog = (model: ModelCatalogItem) => {
    setEditingModelId(model.id);
    setCatalogDraft(toCatalogDraft(model));
    setCatalogDialogOpen(true);
    setError(null);
  };

  const saveCatalog = async () => {
    setError(null);
    setMessage(null);
    await saveCatalogMutation.mutateAsync(catalogDraft);
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Modeles"
        baseline="Administrez le catalogue global puis choisissez les modeles actifs par projet."
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="default">{activeCount} selectionnes</Badge>
            <Badge variant="outline" className="capitalize">
              plan {planLabel}
            </Badge>
            <Badge variant="outline">{catalog.length} au catalogue</Badge>
          </>
        }
        actions={
          activeTab === "project" ? (
            <Button
              type="button"
              className="gap-2"
              onClick={() => void saveModels()}
              disabled={
                saving || loading || !selectedProject || selectedModelIds.length === 0
              }
            >
              {saving ? "Enregistrement..." : "Enregistrer les modeles"}
            </Button>
          ) : (
            <Button
              type="button"
              className="gap-2"
              onClick={openCreateDialog}
              disabled={!organizationId}
            >
              <Plus />
              Nouveau modele
            </Button>
          )
        }
      />

      <div className="flex min-h-0 flex-1 flex-col rounded-md rounded-tr-none bg-background">
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b px-4 pt-4 md:px-6">
            <TabsList>
              <TabsTrigger value="project">Projet</TabsTrigger>
              <TabsTrigger value="catalog">Catalogue</TabsTrigger>
            </TabsList>
          </div>

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

          <TabsContent value="project" className="m-0 flex min-h-0 flex-1 flex-col">
            <div className="border-b px-4 py-3 md:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {selectedProject?.brandName ||
                      selectedProject?.name ||
                      "Aucun projet selectionne"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Selectionnez les modeles actifs du projet a partir du catalogue global.
                  </p>
                </div>

                <div className="w-full lg:max-w-xs">
                  <Select
                    value={selectedProjectId || undefined}
                    onValueChange={setSelectedProjectId}
                    disabled={projects.length === 0}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un projet" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.brandName || project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border-b px-3 pb-3 pt-0 md:px-4 md:pb-4">
              <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                <Badge
                  variant="outline"
                  className="h-10 justify-center rounded-full px-4 text-xs sm:h-8"
                >
                  {selectedModelIds.length}/{selectionLimit || 0} modeles
                </Badge>

                <div className="relative w-full min-w-0 sm:min-w-[260px] sm:flex-1 lg:max-w-[420px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={projectSearch}
                    onChange={(event) => setProjectSearch(event.target.value)}
                    className="h-10 pl-9 sm:h-8"
                    placeholder="Rechercher dans les modeles actifs"
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
              {!organizationId ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
                  Selectionne d&apos;abord une organisation pour configurer les modeles d&apos;un projet.
                </div>
              ) : loading ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
                  Chargement des modeles...
                </div>
              ) : filteredProjectCatalog.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
                  Aucun modele actif disponible pour cette recherche.
                </div>
              ) : (
                <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-stretch gap-4">
                  {filteredProjectCatalog.map((model) => {
                    const isSelected = selectedModelIds.includes(model.id);
                    const disabledByPlan =
                      !isSelected && selectedModelIds.length >= selectionLimit;

                    return (
                      <div
                        key={model.id}
                        className={cn(
                          "h-full min-w-0",
                          disabledByPlan && "opacity-70",
                        )}
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
          </TabsContent>

          <TabsContent value="catalog" className="m-0 flex min-h-0 flex-1 flex-col">
            <div className="border-b px-4 py-3 md:px-6">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    Catalogue global des modeles
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Cree, edite ou desactive les modeles proposes dans l&apos;onboarding et les projets.
                  </p>
                </div>

                <div className="relative w-full min-w-0 lg:max-w-[420px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={catalogSearch}
                    onChange={(event) => setCatalogSearch(event.target.value)}
                    className="pl-9"
                    placeholder="Rechercher dans le catalogue"
                  />
                </div>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
              {!organizationId ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
                  Selectionne d&apos;abord une organisation pour administrer le catalogue.
                </div>
              ) : projectsCatalogQuery.isLoading ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
                  Chargement du catalogue...
                </div>
              ) : filteredAdminCatalog.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
                  Aucun modele ne correspond a cette recherche.
                </div>
              ) : (
                <div className="grid gap-4 xl:grid-cols-2">
                  {filteredAdminCatalog.map((model) => (
                    <div
                      key={model.id}
                      className="rounded-3xl border border-border/70 bg-card p-5"
                    >
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-base font-semibold text-foreground">
                              {model.name}
                            </p>
                            <Badge variant={model.isActive ? "default" : "outline"}>
                              {model.isActive ? "Actif" : "Desactive"}
                            </Badge>
                            {model.supportsLiveSearch ? (
                              <Badge variant="outline">Live search</Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {model.modelGroup} · {model.provider} ·{" "}
                            {model.providerModelId}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            id: {model.id} · icon: {model.iconKey}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Actif</span>
                            <Switch
                              checked={model.isActive}
                              disabled={toggleCatalogMutation.isPending}
                              onCheckedChange={(checked) =>
                                void toggleCatalogMutation.mutateAsync({
                                  modelId: model.id,
                                  isActive: checked,
                                })
                              }
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => openEditDialog(model)}
                          >
                            <Pencil />
                            Editer
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog
        open={catalogDialogOpen}
        onOpenChange={(open) => {
          setCatalogDialogOpen(open);
          if (!open) {
            setEditingModelId(null);
            setCatalogDraft(emptyCatalogDraft());
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingModelId ? "Editer le modele" : "Ajouter un modele"}
            </DialogTitle>
            <DialogDescription>
              Le catalogue global alimente a la fois l&apos;onboarding et la configuration des projets.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="catalog-model-id">ID interne</Label>
              <Input
                id="catalog-model-id"
                value={catalogDraft.id}
                disabled={editingModelId !== null}
                onChange={(event) =>
                  setCatalogDraft((current) => ({
                    ...current,
                    id: event.target.value,
                  }))
                }
                placeholder="ex: gpt-oss-20b-free"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalog-model-name">Nom affiche</Label>
              <Input
                id="catalog-model-name"
                value={catalogDraft.displayName}
                onChange={(event) =>
                  setCatalogDraft((current) => ({
                    ...current,
                    displayName: event.target.value,
                  }))
                }
                placeholder="GPT-4o Mini"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalog-model-group">Groupe</Label>
              <Input
                id="catalog-model-group"
                value={catalogDraft.groupName}
                onChange={(event) =>
                  setCatalogDraft((current) => ({
                    ...current,
                    groupName: event.target.value,
                  }))
                }
                placeholder="chatgpt"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalog-model-provider">Provider</Label>
              <Input
                id="catalog-model-provider"
                value={catalogDraft.provider}
                onChange={(event) =>
                  setCatalogDraft((current) => ({
                    ...current,
                    provider: event.target.value,
                  }))
                }
                placeholder="openai"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalog-model-provider-id">Provider model ID</Label>
              <Input
                id="catalog-model-provider-id"
                value={catalogDraft.providerModelId}
                onChange={(event) =>
                  setCatalogDraft((current) => ({
                    ...current,
                    providerModelId: event.target.value,
                  }))
                }
                placeholder="openai/gpt-oss-20b:free"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="catalog-model-icon">Icon key</Label>
              <Input
                id="catalog-model-icon"
                value={catalogDraft.iconKey}
                onChange={(event) =>
                  setCatalogDraft((current) => ({
                    ...current,
                    iconKey: event.target.value,
                  }))
                }
                placeholder="openai"
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Actif dans le catalogue
                </p>
                <p className="text-sm text-muted-foreground">
                  Un modele inactif disparait de l&apos;onboarding et ne peut plus etre selectionne sur les projets.
                </p>
              </div>
              <Switch
                checked={catalogDraft.isActive}
                onCheckedChange={(checked) =>
                  setCatalogDraft((current) => ({
                    ...current,
                    isActive: checked,
                  }))
                }
              />
            </div>

            <div className="flex items-center justify-between rounded-2xl border border-border/70 px-4 py-3 sm:col-span-2">
              <div>
                <p className="text-sm font-medium text-foreground">
                  Supporte la recherche live
                </p>
                <p className="text-sm text-muted-foreground">
                  Active le badge Live dans les cartes et les vues projet.
                </p>
              </div>
              <Switch
                checked={catalogDraft.supportsLiveSearch}
                onCheckedChange={(checked) =>
                  setCatalogDraft((current) => ({
                    ...current,
                    supportsLiveSearch: checked,
                  }))
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCatalogDialogOpen(false)}
            >
              Annuler
            </Button>
            <Button
              onClick={() => void saveCatalog()}
              disabled={saveCatalogMutation.isPending}
            >
              {saveCatalogMutation.isPending
                ? "Enregistrement..."
                : editingModelId
                  ? "Mettre a jour"
                  : "Creer le modele"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default ModelsTemplate;
