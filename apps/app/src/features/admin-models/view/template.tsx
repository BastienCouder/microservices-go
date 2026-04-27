"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CloudDownload,
  RefreshCw,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  buildProviderLabel,
  filterModelCatalogForAdmin,
  loadModelCatalog,
  normalizeProviderId,
  syncOpenRouterModelCatalog,
  updateCatalogModel,
  sortCatalogItemsByProvider,
  type ModelCatalogAdminFilters,
} from "@/features/models/_lib/catalog-client";
import type {
  ModelCatalogItem,
  OpenRouterModelSyncInput,
} from "@/features/models/_lib/model-access";
import { PageHeader } from "@/components/shared/page-header";
import { appQueryKeys } from "@/lib/query-keys";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";
import { cn } from "@/lib/utils";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationID,
} from "@/shared/selection";

type AdminModelsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

const EMPTY_MODEL_CATALOG: ModelCatalogItem[] = [];

export function AdminModelsTemplate({
  apiBaseURL,
  routeSearch,
}: AdminModelsTemplateProps) {
  const queryClient = useQueryClient();
  const [organizationId, setOrganizationId] = useState("");
  const [search, setSearch] = useState("");
  const [provider, setProvider] = useState("all");
  const [status, setStatus] =
    useState<ModelCatalogAdminFilters["status"]>("all");
  const [variant, setVariant] = useState<NonNullable<OpenRouterModelSyncInput["variant"]>>("all");
  const [toolsOnly, setToolsOnly] = useState(false);
  const [onlyFree, setOnlyFree] = useState(false);
  const [purgeUnsupportedProviders, setPurgeUnsupportedProviders] =
    useState(false);
  const [minContext, setMinContext] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setOrganizationId(
      readSelectedOrganizationID() || readOrganizationIdFromSearch(routeSearch),
    );
  }, [routeSearch]);

  const catalogQuery = useQuery({
    queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "all"),
    enabled: apiBaseURL.trim() !== "" && organizationId !== "",
    queryFn: ({ signal }) =>
      loadModelCatalog(apiBaseURL, organizationId, {
        activeOnly: false,
        signal,
      }),
  });

  const catalog = catalogQuery.data ?? EMPTY_MODEL_CATALOG;
  const providerOptions = useMemo(
    () =>
      Array.from(
        new Set(
          catalog
            .map((model) => normalizeProviderId(model.provider))
            .filter(Boolean),
        ),
      ).sort((left, right) =>
        buildProviderLabel(left).localeCompare(buildProviderLabel(right)),
      ),
    [catalog],
  );
  const filteredCatalog = useMemo(
    () =>
      sortCatalogItemsByProvider(
        filterModelCatalogForAdmin(catalog, {
        provider: provider === "all" ? "" : provider,
        search,
        status,
        supportsLiveSearch: toolsOnly,
        }),
      ),
    [catalog, provider, search, status, toolsOnly],
  );
  const activeCount = catalog.filter((model) => model.isActive).length;
  const inactiveCount = catalog.length - activeCount;

  const toggleModelMutation = useMutation({
    mutationFn: ({
      model,
      isActive,
    }: {
      model: ModelCatalogItem;
      isActive: boolean;
    }) =>
      updateCatalogModel(apiBaseURL, organizationId, model.id, {
        isActive,
      }),
    onSuccess: async (updatedModel) => {
      queryClient.setQueryData(
        appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "all"),
        (current: ModelCatalogItem[] | undefined) =>
          (current ?? []).map((model) =>
            model.id === updatedModel.id ? updatedModel : model,
          ),
      );
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.modelsCatalog(
            apiBaseURL,
            organizationId,
            "active",
          ),
        }),
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "all"),
        }),
      ]);
      setMessage(
        `${updatedModel.name} est maintenant ${
          updatedModel.isActive ? "actif" : "inactif"
        }.`,
      );
    },
    onError: (error) => {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de mettre a jour ce modele.",
      );
    },
  });

  const syncOpenRouterMutation = useMutation({
    mutationFn: () =>
      syncOpenRouterModelCatalog(apiBaseURL, organizationId, {
        onlyFree,
        minContext: Number.parseInt(minContext, 10) || undefined,
        supportsTools: toolsOnly,
        variant,
        providers: provider === "all" ? [] : [provider],
        searchQuery: search,
        activateImported: false,
        purgeUnsupportedProviders,
      }),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "all"),
        }),
        queryClient.invalidateQueries({
          queryKey: appQueryKeys.modelsCatalog(
            apiBaseURL,
            organizationId,
            "active",
          ),
        }),
      ]);
      setMessage(
        `OpenRouter synchronise : ${result.imported} modeles importes (${result.created} nouveaux, ${result.updated} mis a jour, ${result.purged} purges).`,
      );
    },
    onError: (error) => {
      setMessage(
        error instanceof Error
          ? error.message
          : "Impossible de synchroniser les modeles OpenRouter.",
      );
    },
  });

  const toggleModel = (model: ModelCatalogItem, isActive: boolean) => {
    setMessage(null);
    void toggleModelMutation.mutateAsync({ model, isActive });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title="Admin modeles LLM"
        baseline="Gerez le catalogue partage utilise par la page Modeles et l'onboarding."
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="default">{activeCount} actifs</Badge>
            <Badge variant="outline">{inactiveCount} inactifs</Badge>
            <Badge variant="outline">{providerOptions.length} providers</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => void catalogQuery.refetch()}
              disabled={catalogQuery.isFetching}
            >
              <RefreshCw data-icon="inline-start" />
              {catalogQuery.isFetching ? "Actualisation..." : "Actualiser"}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setMessage(null);
                void syncOpenRouterMutation.mutateAsync();
              }}
              disabled={!organizationId || syncOpenRouterMutation.isPending}
            >
              <CloudDownload data-icon="inline-start" />
              {syncOpenRouterMutation.isPending
                ? "Import OpenRouter..."
                : "Importer OpenRouter"}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col rounded-md rounded-tr-none bg-background">
        <div className="border-b px-4 py-4 md:px-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_160px_150px_150px_auto_auto_auto] xl:items-center">
            <div className="relative min-w-0">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher par nom, id ou provider"
                className="pl-9"
              />
            </div>

            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les providers</SelectItem>
                {providerOptions.map((providerId) => (
                  <SelectItem key={providerId} value={providerId}>
                    {buildProviderLabel(providerId)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={status}
              onValueChange={(value) =>
                setStatus(value as ModelCatalogAdminFilters["status"])
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="active">Actifs</SelectItem>
                <SelectItem value="inactive">Inactifs</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={variant}
              onValueChange={(value) =>
                setVariant(value as NonNullable<OpenRouterModelSyncInput["variant"]>)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="instruct">Instruct</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex min-h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-muted-foreground">
              <Checkbox
                checked={toolsOnly}
                onCheckedChange={(checked) => setToolsOnly(checked === true)}
              />
              Tools
            </label>

            <Input
              value={minContext}
              onChange={(event) => setMinContext(event.target.value)}
              inputMode="numeric"
              placeholder="Contexte min"
            />

            <label className="flex min-h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-muted-foreground">
              <Checkbox
                checked={onlyFree}
                onCheckedChange={(checked) => setOnlyFree(checked === true)}
              />
              Free
            </label>

            <label className="flex min-h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-muted-foreground">
              <Checkbox
                checked={purgeUnsupportedProviders}
                onCheckedChange={(checked) =>
                  setPurgeUnsupportedProviders(checked === true)
                }
              />
              Purger
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            L'import OpenRouter utilise la recherche, le provider, le type
            chat/instruct, le contexte minimum, Free et Tools comme filtres.
            Purger supprime les anciens imports OpenRouter dont le provider
            n'est plus supporte.
          </p>
        </div>

        {(message || catalogQuery.error instanceof Error) ? (
          <div className="border-b px-4 py-3 md:px-6">
            <div
              className={cn(
                "rounded-xl border px-4 py-3 text-sm",
                catalogQuery.error instanceof Error
                  ? "border-destructive/20 bg-destructive/5 text-destructive"
                  : "border-border/70 bg-muted/30 text-foreground",
              )}
            >
              {catalogQuery.error instanceof Error
                ? catalogQuery.error.message
                : message}
            </div>
          </div>
        ) : null}

        <div className="px-4 py-4 md:px-6">
          {!organizationId ? (
            <EmptyState label="Selectionnez une organisation pour charger le catalogue." />
          ) : catalogQuery.isLoading ? (
            <EmptyState label="Chargement du catalogue LLM..." />
          ) : filteredCatalog.length === 0 ? (
            <EmptyState label="Aucun modele ne correspond a ces filtres." />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Modele</TableHead>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model ID</TableHead>
                    <TableHead className="text-center">Tools</TableHead>
                    <TableHead className="w-[140px] text-right">Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCatalog.map((model) => {
                    const pending =
                      toggleModelMutation.isPending &&
                      toggleModelMutation.variables?.model.id === model.id;

                    return (
                      <TableRow key={model.id}>
                        <TableCell>
                          <div className="flex min-w-[220px] items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background p-2">
                              {model.icon ? (
                                <img
                                  src={toSafeImageAssetPath(model.icon)}
                                  alt=""
                                  className="size-full object-contain"
                                  loading="lazy"
                                  decoding="async"
                                />
                              ) : (
                                <Bot aria-hidden="true" className="size-5" />
                              )}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-foreground">
                                {model.name}
                              </div>
                              <div className="truncate text-xs text-muted-foreground">
                                {model.id}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {buildProviderLabel(model.provider)}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="block max-w-[320px] truncate text-muted-foreground">
                            {model.providerModelId}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {model.supportsLiveSearch ? (
                            <Badge variant="secondary">Oui</Badge>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-3">
                            <span
                              className={cn(
                                "text-xs font-medium",
                                model.isActive
                                  ? "text-primary"
                                  : "text-muted-foreground",
                              )}
                            >
                              {model.isActive ? "Actif" : "Inactif"}
                            </span>
                            <Switch
                              checked={model.isActive}
                              disabled={pending}
                              onCheckedChange={(checked) =>
                                toggleModel(model, checked)
                              }
                              aria-label={`Changer le statut de ${model.name}`}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </div>

        <div className="border-t px-4 py-3 text-xs text-muted-foreground md:px-6">
          <SlidersHorizontal data-icon="inline-start" />
          Les providers affiches dans le panel de cles API viennent uniquement
          des modeles actifs de ce catalogue.
        </div>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/70 px-4 py-10 text-sm text-muted-foreground">
      {label}
    </div>
  );
}
