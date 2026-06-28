"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bot,
  CloudDownload,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
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
import {
  loadOrganizationSummaries,
} from "@/features/organizations/_lib/shared/organization-page-api";
import { appQueryKeys } from "@/lib/query-keys";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";
import { cn } from "@/lib/utils";
import {
  resolvePreferredAdminOrganization,
} from "@/shared/admin-routing";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type AdminModelsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

const EMPTY_MODEL_CATALOG: ModelCatalogItem[] = [];

function formatPricePerMillion(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "-";
  return `$${value.toLocaleString("fr-FR", {
    maximumFractionDigits: 4,
  })}`;
}

function formatOpenRouterPricing(pricing: Record<string, unknown> | null) {
  if (!pricing || Object.keys(pricing).length === 0) return "-";
  return JSON.stringify(pricing);
}

export function AdminModelsTemplate({
  apiBaseURL,
  routeSearch,
}: AdminModelsTemplateProps) {
  const { t } = useScopedI18n("admin-models");
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
  const [purgeMissingModels, setPurgeMissingModels] = useState(false);
  const [minContext, setMinContext] = useState("");
  const organizationsQuery = useQuery({
    queryKey: appQueryKeys.organizations(apiBaseURL, "admin-models", "admin"),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) =>
      loadOrganizationSummaries(apiBaseURL, signal, { adminScope: true }),
  });

  const requestedOrganizationId = useMemo(
    () => readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationPublicID(),
    [routeSearch],
  );
  const adminOrganization = useMemo(
    () =>
      resolvePreferredAdminOrganization(
        organizationsQuery.data ?? [],
        requestedOrganizationId,
      ),
    [organizationsQuery.data, requestedOrganizationId],
  );
  useEffect(() => {
    setOrganizationId(adminOrganization?.publicId || adminOrganization?.id || requestedOrganizationId);
  }, [adminOrganization?.id, adminOrganization?.publicId, requestedOrganizationId]);

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
          freeOnly: onlyFree,
        }),
      ),
    [catalog, onlyFree, provider, search, status, toolsOnly],
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
      await invalidateQueryKeys(queryClient, [
        appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "active"),
        appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "all"),
        appQueryKeys.modelsCatalog(apiBaseURL, "__onboarding__", "active"),
      ]);
      pushSuccessToast(t("modelUpdateSuccess", {
        name: updatedModel.name,
        status: updatedModel.isActive ? t("activeState") : t("inactiveState"),
      }));
    },
    onError: (error) => {
      pushErrorToast(error, t("modelUpdateError"));
    },
  });

  const syncOpenRouterMutation = useMutation({
    mutationFn: () =>
      syncOpenRouterModelCatalog(apiBaseURL, organizationId, {
        minContext: Number.parseInt(minContext, 10) || undefined,
        supportsTools: toolsOnly,
        onlyFree,
        variant,
        providers: provider === "all" ? [] : [provider],
        searchQuery: search,
        activateImported: false,
        purgeUnsupportedProviders,
        purgeMissingModels,
      }),
    onSuccess: async (result) => {
      await invalidateQueryKeys(queryClient, [
        appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "all"),
        appQueryKeys.modelsCatalog(apiBaseURL, organizationId, "active"),
        appQueryKeys.modelsCatalog(apiBaseURL, "__onboarding__", "active"),
      ]);
      pushSuccessToast(t("openRouterSyncSuccess", result));
    },
    onError: (error) => {
      pushErrorToast(error, t("openRouterSyncError"));
    },
  });

  const toggleModel = (model: ModelCatalogItem, isActive: boolean) => {
    toggleModelMutation.mutate({ model, isActive });
  };

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title={t("pageTitle")}
        baseline={t("pageBaseline")}
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="default">{t("activeCount", { count: activeCount })}</Badge>
            <Badge variant="outline">{t("inactiveCount", { count: inactiveCount })}</Badge>
            <Badge variant="outline">{t("providersCount", { count: providerOptions.length })}</Badge>
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                syncOpenRouterMutation.mutate();
              }}
              disabled={!organizationId || syncOpenRouterMutation.isPending}
            >
              <CloudDownload data-icon="inline-start" />
              {syncOpenRouterMutation.isPending
                ? t("importingOpenRouter")
                : t("importOpenRouter")}
            </Button>
          </div>
        }
      />

      <div className="flex flex-col rounded-md rounded-tr-none bg-background">
        <div className="border-b px-4 py-4 md:px-6">
          <div className="grid gap-3 xl:grid-cols-[minmax(260px,1fr)_180px_160px_150px_150px_auto_auto_auto_auto] xl:items-center">
            <div className="relative min-w-0">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchPlaceholder")}
                className="pl-9"
              />
            </div>

            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("providerPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allProviders")}</SelectItem>
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
                <SelectValue placeholder={t("statusPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allStatuses")}</SelectItem>
                <SelectItem value="active">{t("active")}</SelectItem>
                <SelectItem value="inactive">{t("inactive")}</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={variant}
              onValueChange={(value) =>
                setVariant(value as NonNullable<OpenRouterModelSyncInput["variant"]>)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("typePlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("allTypes")}</SelectItem>
                <SelectItem value="chat">{t("chat")}</SelectItem>
                <SelectItem value="instruct">{t("instruct")}</SelectItem>
              </SelectContent>
            </Select>

            <label className="flex min-h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-muted-foreground">
              <Checkbox
                checked={toolsOnly}
                onCheckedChange={(checked) => setToolsOnly(checked === true)}
              />
              {t("toolsLabel")}
            </label>

            <Input
              value={minContext}
              onChange={(event) => setMinContext(event.target.value)}
              inputMode="numeric"
              placeholder={t("minContextPlaceholder")}
            />

            <label className="flex min-h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-muted-foreground">
              <Checkbox
                checked={onlyFree}
                onCheckedChange={(checked) => setOnlyFree(checked === true)}
              />
              {t("freeLabel")}
            </label>

            <label className="flex min-h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-muted-foreground">
              <Checkbox
                checked={purgeUnsupportedProviders}
                onCheckedChange={(checked) =>
                  setPurgeUnsupportedProviders(checked === true)
                }
              />
              {t("purgeLabel")}
            </label>

            <label className="flex min-h-8 items-center gap-2 rounded-lg border border-border/70 px-3 text-sm text-muted-foreground">
              <Checkbox
                checked={purgeMissingModels}
                onCheckedChange={(checked) => setPurgeMissingModels(checked === true)}
              />
              {t("purgeMissingLabel")}
            </label>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {t("importHelp")}
          </p>
        </div>

        <div className="px-4 py-4 md:px-6">
          {!organizationId ? (
            <EmptyState label={t("noOrganizationSelected")} />
          ) : catalogQuery.isLoading ? (
            <EmptyState label={t("loadingCatalog")} />
          ) : filteredCatalog.length === 0 ? (
            <EmptyState label={t("noModelMatches")} />
          ) : (
            <div className="overflow-hidden rounded-xl border border-border/70">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columnModel")}</TableHead>
                    <TableHead>{t("columnProvider")}</TableHead>
                    <TableHead>{t("columnModelId")}</TableHead>
                    <TableHead>{t("columnOpenRouterPricing")}</TableHead>
                    <TableHead className="text-right">{t("columnInputPerMillion")}</TableHead>
                    <TableHead className="text-right">{t("columnOutputPerMillion")}</TableHead>
                    <TableHead className="text-center">{t("columnCredits")}</TableHead>
                    <TableHead className="text-center">{t("columnTools")}</TableHead>
                    <TableHead className="w-[140px] text-right">{t("columnStatus")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCatalog.map((model) => {
                    const pending =
                      toggleModelMutation.isPending &&
                      toggleModelMutation.variables?.model.id === model.id;
                    const safeIconPath = toSafeImageAssetPath(model.icon);

                    return (
                      <TableRow key={model.id}>
                        <TableCell>
                          <div className="flex min-w-[220px] items-center gap-3">
                            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background p-2">
                              {safeIconPath ? (
                                <img
                                  src={safeIconPath}
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
                        <TableCell>
                          <code className="block max-w-[360px] truncate rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                            {formatOpenRouterPricing(model.openRouterPricing)}
                          </code>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatPricePerMillion(model.inputPricePerMillion)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatPricePerMillion(model.outputPricePerMillion)}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">
                            {t("callCost", { count: model.creditCost })}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {model.supportsLiveSearch ? (
                            <Badge variant="secondary">{t("yes")}</Badge>
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
                              {model.isActive ? t("activeBadge") : t("inactiveBadge")}
                            </span>
                            <Switch
                              checked={model.isActive}
                              disabled={pending}
                              onCheckedChange={(checked) =>
                                toggleModel(model, checked)
                              }
                              aria-label={t("changeStatusAria", { name: model.name })}
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
          {t("providersPanelHint")}
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
