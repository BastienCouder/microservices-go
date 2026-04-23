"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ModelCard } from "@/features/monitoring/_components/shared/model-card";
import {
  createProviderCredentialLookup,
  getProviderCredentialOptions,
  getProviderKeyRequirements,
  isProviderUsableWithCredentials,
  loadLLMProviderCredentials,
  loadProjectModels,
  loadProjectsAndCatalog,
  sortCatalogItemsByProvider,
} from "@/features/models/_lib/catalog-client";
import { useProjectModelSelection } from "@/features/models/_hooks/use-project-model-selection";
import { useProviderCredentialMutations } from "@/features/models/_hooks/use-provider-credential-mutations";
import { PageHeader } from "@/features/shared/view/page-header";
import { appQueryKeys } from "@/lib/query-keys";
import { cn } from "@/lib/utils";
import { loadBillingEntitlements } from "@/shared/billing";
import { isDeveloperBillingPlan } from "@/shared/billing-plan";
import {
  getPlanLabel,
  readSelectedOrganizationId,
  type LLMProviderCredentialStatus,
  type ModelCatalogItem,
  type ModelsProjectSummary,
} from "../_lib/model-access";
import { DeveloperPlanHeroBanner } from "../_components/developer-plan-hero-banner";
import { ModelsPanelLoading } from "../_components/models-panel-loading";
import { ProviderApiKeysPanel } from "../_components/provider-api-keys-panel";

type ModelsClientProps = {
  apiBaseURL: string;
  routeSearch: string;
};

const EMPTY_PROJECTS: ModelsProjectSummary[] = [];
const EMPTY_MODEL_CATALOG: ModelCatalogItem[] = [];
const EMPTY_PROVIDER_CREDENTIALS: LLMProviderCredentialStatus[] = [];
const PROVIDER_API_KEY_TEXTS = {
  empty: "Selectionnez un modele pour voir les fournisseurs a configurer.",
  configured: "Cle configuree",
  missing: "Cle requise",
  connect: "Connecter",
  manage: "Gerer la cle",
  delete: "Supprimer la cle",
  fieldLabel: "Cle API",
  placeholder: "Coller la cle API",
  save: "Enregistrer",
  saving: "Enregistrement...",
};

function sanitizeLegacyModelUpdateError(rawError: string | undefined): string {
  const fallback = "Impossible de mettre a jour les modeles du projet.";
  const normalized = (rawError ?? "").trim();
  if (!normalized) return fallback;

  if (normalized.toLowerCase().includes("monthly model change limit reached")) {
    return fallback;
  }

  return normalized;
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

export function ModelsClient({
  apiBaseURL,
  routeSearch,
}: ModelsClientProps) {
  const queryClient = useQueryClient();
  const [organizationId] = useState(readSelectedOrganizationId);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [providerKeyDrafts, setProviderKeyDrafts] = useState<
    Record<string, string>
  >({});
  const hintedProjectId = useMemo(
    () => readProjectIdFromSearch(routeSearch),
    [routeSearch],
  );
  const normalizedApiBaseURL = apiBaseURL.trim();

  const projectsCatalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId),
    enabled: normalizedApiBaseURL !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadProjectsAndCatalog(apiBaseURL, organizationId, { signal }),
  });

  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, organizationId),
    enabled: normalizedApiBaseURL !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, organizationId, { signal }),
  });

  const projects = projectsCatalogQuery.data?.projects ?? EMPTY_PROJECTS;
  const catalog = projectsCatalogQuery.data?.catalog ?? EMPTY_MODEL_CATALOG;
  const selectedProjectId = useMemo(() => {
    if (!organizationId) return "";
    if (hintedProjectId && projects.some((project) => project.id === hintedProjectId)) {
      return hintedProjectId;
    }
    return projects[0]?.id ?? "";
  }, [hintedProjectId, organizationId, projects]);
  const catalogModelIDs = useMemo(
    () => new Set(catalog.map((model) => model.id)),
    [catalog],
  );
  const catalogById = useMemo(
    () => new Map(catalog.map((model) => [model.id, model])),
    [catalog],
  );
  const selectionLimit = useMemo(() => {
    const limit = billingQuery.data?.modelSelectionLimit ?? 0;
    return limit > 0 ? limit : catalog.length;
  }, [billingQuery.data?.modelSelectionLimit, catalog.length]);
  const currentPlan = billingQuery.data?.plan ?? null;
  const planLabel = currentPlan ? getPlanLabel(currentPlan) : null;
  const isDeveloperPlan = isDeveloperBillingPlan(currentPlan);
  const showDeveloperUpgradeBanner =
    !isDeveloperPlan && !billingQuery.isLoading && !billingQuery.error;

  const providerCredentialsQuery = useQuery({
    queryKey: appQueryKeys.llmProviderCredentials(
      apiBaseURL,
      organizationId,
      selectedProjectId,
    ),
    enabled:
      isDeveloperPlan &&
      normalizedApiBaseURL !== "" &&
      organizationId !== "" &&
      selectedProjectId !== "",
    queryFn: ({ signal }) =>
      loadLLMProviderCredentials(
        apiBaseURL,
        organizationId,
        selectedProjectId,
        signal,
      ),
  });
  const providerCredentials =
    providerCredentialsQuery.data ?? EMPTY_PROVIDER_CREDENTIALS;
  const providerCredentialLookup = useMemo(
    () => createProviderCredentialLookup(providerCredentials),
    [providerCredentials],
  );
  const providerCredentialsReady =
    !isDeveloperPlan ||
    providerCredentialsQuery.isFetched ||
    providerCredentialsQuery.isError;
  const usableModelIDs = useMemo(
    () =>
      new Set(
        catalog
          .filter(
            (model) =>
              model.isActive &&
              (!isDeveloperPlan ||
                !providerCredentialsReady ||
                isProviderUsableWithCredentials(
                  model.provider,
                  providerCredentials,
                  providerCredentialLookup,
                )),
          )
          .map((model) => model.id),
      ),
    [
      catalog,
      isDeveloperPlan,
      providerCredentialLookup,
      providerCredentials,
      providerCredentialsReady,
    ],
  );

  const projectModelsQuery = useQuery({
    queryKey: appQueryKeys.projectModels(
      apiBaseURL,
      organizationId,
      selectedProjectId,
    ),
    enabled:
      normalizedApiBaseURL !== "" &&
      organizationId !== "" &&
      selectedProjectId !== "",
    queryFn: ({ signal }) =>
      loadProjectModels(apiBaseURL, organizationId, selectedProjectId, signal),
  });
  const {
    selectedModelIds,
    setSelectedModelIds,
  } = useProjectModelSelection({
    projectId: selectedProjectId,
    serverModelIds: projectModelsQuery.data,
    catalogModelIDs: catalogModelIDs,
    usableModelIDs: usableModelIDs,
    enforceUsableFilter: !isDeveloperPlan || providerCredentialsReady,
  });
  const selectedModelIdSet = useMemo(
    () => new Set(selectedModelIds),
    [selectedModelIds],
  );

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
            modelIds,
          }),
          credentials: "include",
        },
      );

      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(sanitizeLegacyModelUpdateError(payload?.error));
      }

      return modelIds;
    },
    onSuccess: async (nextModelIds) => {
      queryClient.setQueryData(
        appQueryKeys.projectModels(apiBaseURL, organizationId, selectedProjectId),
        nextModelIds,
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.projectModels(
            apiBaseURL,
            organizationId,
            selectedProjectId,
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: ["monitoring", apiBaseURL, selectedProjectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["perception", apiBaseURL, selectedProjectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["prompts", apiBaseURL, organizationId, selectedProjectId],
        }),
        queryClient.invalidateQueries({
          queryKey: [
            "prompts",
            "catalog",
            apiBaseURL,
            organizationId,
            selectedProjectId,
          ],
        }),
      ]);
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

  const {
    pendingProvider,
    saveProviderCredential,
    deleteProviderCredential,
    saveProviderCredentialMutation,
    deleteProviderCredentialMutation,
  } = useProviderCredentialMutations({
    apiBaseURL,
    organizationId,
    projectId: selectedProjectId,
    onSaveSuccess: (credential) => {
      setProviderKeyDrafts((current) => ({
        ...current,
        [credential.provider]: "",
      }));
      setError(null);
      setMessage(`Cle API ${credential.label} enregistree.`);
    },
    onDeleteSuccess: (credential) => {
      setProviderKeyDrafts((current) => ({
        ...current,
        [credential.provider]: "",
      }));
      setError(null);
      setMessage(`Cle API ${credential.label} supprimee.`);
    },
    onSaveError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible d'enregistrer la cle API LLM.",
      );
    },
    onDeleteError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : "Impossible de supprimer la cle API LLM.",
      );
    },
  });

  const loading =
    projectsCatalogQuery.isLoading ||
    (projectsCatalogQuery.isFetching && !projectsCatalogQuery.data) ||
    (selectedProjectId !== "" &&
      (projectModelsQuery.isLoading ||
        (projectModelsQuery.isFetching && !projectModelsQuery.data)));

  const queryError = useMemo(() => {
    if (organizationId === "") return null;
    if (projectsCatalogQuery.error instanceof Error && !projectsCatalogQuery.data) {
      return projectsCatalogQuery.error.message;
    }
    if (
      selectedProjectId !== "" &&
      projectModelsQuery.error instanceof Error &&
      !projectModelsQuery.data
    ) {
      return projectModelsQuery.error.message;
    }
    return null;
  }, [
    organizationId,
    projectModelsQuery.data,
    projectModelsQuery.error,
    projectsCatalogQuery.data,
    projectsCatalogQuery.error,
    selectedProjectId,
  ]);
  const displayError = error ?? queryError;

  const filteredCatalog = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = !normalizedSearch
      ? catalog
      : catalog.filter((model) =>
          [
            model.modelGroup,
            model.name,
            model.provider,
            model.providerModelId,
            model.description,
          ].some((value) => value.toLowerCase().includes(normalizedSearch)),
        );

    return sortCatalogItemsByProvider(filtered);
  }, [catalog, search]);

  const selectedProject = useMemo(
    () => projects.find((project) => project.id === selectedProjectId) || null,
    [projects, selectedProjectId],
  );
  const providerKeyRequirements = useMemo(
    () =>
      getProviderKeyRequirements(
        catalog,
        selectedModelIds,
        providerCredentials,
        providerCredentialLookup,
      ),
    [catalog, providerCredentialLookup, providerCredentials, selectedModelIds],
  );
  const providerCredentialOptions = useMemo(
    () =>
      getProviderCredentialOptions(
        catalog,
        providerCredentials,
        providerCredentialLookup,
      ),
    [catalog, providerCredentialLookup, providerCredentials],
  );
  const missingProviderLabels = providerKeyRequirements
    .filter((requirement) => !requirement.hasApiKey)
    .map((requirement) => requirement.label);
  const developerPlanMissingKeys =
    isDeveloperPlan &&
    providerCredentialsReady &&
    selectedModelIds.length > 0 &&
    missingProviderLabels.length > 0;

  const updateProviderKeyDraft = useCallback((provider: string, value: string) => {
    setProviderKeyDrafts((current) => ({
      ...current,
      [provider]: value,
    }));
  }, []);

  const saveProviderKey = useCallback(
    (provider: string) => {
      if (!selectedProjectId) {
        setError("Selectionnez un projet avant d'enregistrer une cle API.");
        return;
      }
      const apiKey = providerKeyDrafts[provider]?.trim() ?? "";
      if (!apiKey) return;

      saveProviderCredential(provider, apiKey);
    },
    [providerKeyDrafts, saveProviderCredential, selectedProjectId],
  );

  const deleteProviderKey = useCallback(
    (provider: string) => {
      if (!selectedProjectId) {
        setError("Selectionnez un projet avant de supprimer une cle API.");
        return;
      }
      deleteProviderCredential(provider);
    },
    [deleteProviderCredential, selectedProjectId],
  );

  const toggleProjectModel = useCallback((modelId: string) => {
    const isSelected = selectedModelIdSet.has(modelId);
    const model = catalogById.get(modelId);

    if (isSelected) {
      setSelectedModelIds((current) =>
        current.filter((value) => value !== modelId),
      );
      setMessage(null);
      return;
    }

    if (!model) {
      return;
    }

    if (isDeveloperPlan && !providerCredentialsReady) {
      setMessage("Chargement des cles API fournisseur...");
      return;
    }

    if (
      isDeveloperPlan &&
      !isProviderUsableWithCredentials(
        model.provider,
        providerCredentials,
        providerCredentialLookup,
      )
    ) {
      setMessage(
        `Ajoutez une cle API pour ${model.provider} ou OpenRouter avant d'utiliser ce modele.`,
      );
      return;
    }

    if (selectedModelIdSet.size >= selectionLimit) {
      setMessage(
        planLabel
          ? `${planLabel} permet jusqu'a ${selectionLimit} modele${
              selectionLimit > 1 ? "s" : ""
            }.`
          : "La limite de votre plan a ete atteinte.",
      );
      return;
    }

    setSelectedModelIds((current) => [...current, modelId]);
    setMessage(null);
  }, [
    catalogById,
    isDeveloperPlan,
    planLabel,
    providerCredentialLookup,
    providerCredentials,
    providerCredentialsReady,
    selectedModelIdSet,
    selectionLimit,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title="Modeles"
        baseline="Choisissez directement les modeles actifs pour le projet."
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="default">{selectedModelIds.length} selectionnes</Badge>
            {planLabel ? (
              <Badge variant="outline" className="capitalize">
                plan {planLabel}
              </Badge>
            ) : null}
            {isDeveloperPlan ? (
              <Badge variant="outline">cles API requises</Badge>
            ) : null}
          </>
        }
      />

      <div className="flex flex-1 flex-col rounded-md bg-background">
        {(displayError || message) && (
          <div className="border-b px-4 py-3 md:px-6">
            {displayError ? (
              <div className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                {displayError}
              </div>
            ) : null}
            {!displayError && message ? (
              <div className="rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm text-foreground">
                {message}
              </div>
            ) : null}
          </div>
        )}

        {showDeveloperUpgradeBanner ? (
          <div className="border-b px-4 py-4 md:px-4">
            <DeveloperPlanHeroBanner currentPlanLabel={planLabel} />
          </div>
        ) : null}

        {isDeveloperPlan ? (
          <div className="border-b px-4 py-4 md:px-6">
            <ProviderApiKeysPanel
              requirements={providerCredentialOptions}
              drafts={providerKeyDrafts}
              pendingProvider={pendingProvider}
              disabled={
                saveProviderCredentialMutation.isPending ||
                deleteProviderCredentialMutation.isPending ||
                providerCredentialsQuery.isFetching ||
                selectedProjectId === ""
              }
              onDraftChange={updateProviderKeyDraft}
              onSave={saveProviderKey}
              onDelete={deleteProviderKey}
              texts={PROVIDER_API_KEY_TEXTS}
            />
            {developerPlanMissingKeys ? (
              <p className="mt-3 text-sm text-destructive">
                Ajoutez une cle API pour {missingProviderLabels.join(", ")} avant
                d&apos;enregistrer ces modeles.
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="border-b px-4 py-4 md:px-6">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <p className="text-sm text-muted-foreground">
              {selectedModelIds.length}/{selectionLimit || 0} modeles actifs
            </p>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un modele"
                className="w-full max-w-96"
              />
              <Button
                type="button"
                onClick={() => void saveModelsMutation.mutateAsync(selectedModelIds)}
                disabled={
                  saveModelsMutation.isPending ||
                  loading ||
                  !selectedProject ||
                  selectedModelIds.length === 0 ||
                  (isDeveloperPlan && !providerCredentialsReady) ||
                  developerPlanMissingKeys
                }
              >
                {saveModelsMutation.isPending
                  ? "Enregistrement..."
                  : "Enregistrer"}
              </Button>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 md:px-6">
          {!organizationId ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
              Selectionne d&apos;abord une organisation.
            </div>
          ) : loading ? (
            <ModelsPanelLoading />
          ) : filteredCatalog.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
              Aucun modele disponible.
            </div>
          ) : (
            <div className="grid w-full grid-cols-[repeat(auto-fit,minmax(220px,1fr))] items-stretch gap-4">
              {filteredCatalog.map((model) => {
                const isSelected = selectedModelIdSet.has(model.id);
                const disabledByPlan =
                  !isSelected && selectedModelIdSet.size >= selectionLimit;
                const disabledByApiKey =
                  isDeveloperPlan &&
                  providerCredentialsReady &&
                  !isProviderUsableWithCredentials(
                    model.provider,
                    providerCredentials,
                    providerCredentialLookup,
                  );
                const disabled = disabledByPlan || disabledByApiKey;

                return (
                  <div
                    key={model.id}
                    className={cn("h-full min-w-0", disabled && "opacity-70")}
                  >
                    <ModelCard
                      name={model.name}
                      description={model.description}
                      icon={model.icon}
                      selected={isSelected}
                      onClick={() => toggleProjectModel(model.id)}
                      modelGroup={model.modelGroup}
                      size="models"
                      disabled={disabled}
                      disabledLabel={
                        disabledByApiKey
                          ? "Cle API requise"
                          : disabledByPlan
                            ? "Limite du plan"
                            : undefined
                      }
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

export default ModelsClient;
