"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getMonitoringQueryContext,
  loadMonitoringData,
  type MonitoringData,
} from "@/features/monitoring/_lib/shared/monitoring-data";
import { appQueryKeys } from "@/lib/query-keys";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";

import { buildPagesPanelViewModel } from "./page-insights";
import type { PageModelBadge } from "./types";

type UsePagesPanelViewModelInput = {
  apiBaseURL: string;
  routeSearch: string;
};

export function usePagesPanelViewModel({
  apiBaseURL,
  routeSearch,
}: UsePagesPanelViewModelInput) {
  const queryContext = useMemo(() => getMonitoringQueryContext(routeSearch), [routeSearch]);
  const organizationId = useMemo(
    () => readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationPublicID() || null,
    [routeSearch],
  );
  const [search, setSearch] = useState("");
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);

  const monitoringQuery = useQuery({
    queryKey: appQueryKeys.monitoring(
      apiBaseURL,
      queryContext.projectId,
      organizationId,
      queryContext.mode,
    ),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadMonitoringData(apiBaseURL, routeSearch, { signal }),
  });

  const monitoring = monitoringQuery.data?.data ?? null;
  const panelModel = useMemo(
    () => (monitoring ? buildPagesPanelViewModel(monitoring) : null),
    [monitoring],
  );
  const pages = useMemo(
    () => panelModel?.pages ?? [],
    [panelModel],
  );
  const modelOptions = useMemo(
    () =>
      Array.from(
        pages
          .flatMap((page) => page.models)
          .reduce((models, model) => {
            models.set(model.id, model);
            return models;
          }, new Map<string, PageModelBadge>())
          .values(),
      )
        .sort((left, right) => left.label.localeCompare(right.label)),
    [pages],
  );
  const allModelsSelected = selectedModelIds.length === 0;

  const filteredPages = useMemo(() => {
    const needle = search.trim().toLowerCase();

    return pages.filter((page) => {
      const matchesSearch =
        !needle ||
        [
          page.url,
          page.hostname,
          page.path,
          page.models.map((model) => model.label).join(" "),
        ]
          .join(" ")
          .toLowerCase()
          .includes(needle);
      const matchesModel =
        allModelsSelected ||
        page.models.some((model) => selectedModelIds.includes(model.id));

      return matchesSearch && matchesModel;
    });
  }, [allModelsSelected, pages, search, selectedModelIds]);

  useEffect(() => {
    if (allModelsSelected) return;

    const availableModelIds = new Set(modelOptions.map((model) => model.id));
    const validSelectedModelIds = selectedModelIds.filter((id) =>
      availableModelIds.has(id),
    );

    if (validSelectedModelIds.length !== selectedModelIds.length) {
      setSelectedModelIds(validSelectedModelIds);
    }
  }, [allModelsSelected, modelOptions, selectedModelIds]);

  function toggleModel(modelId: string) {
    if (allModelsSelected) {
      setSelectedModelIds([modelId]);
      return;
    }

    setSelectedModelIds((current) =>
      current.includes(modelId)
        ? current.filter((id) => id !== modelId)
        : [...current, modelId],
    );
  }

  useEffect(() => {
    if (filteredPages.length === 0) {
      setSelectedPageUrl(null);
      return;
    }

    if (!selectedPageUrl || !filteredPages.some((page) => page.url === selectedPageUrl)) {
      setSelectedPageUrl(filteredPages[0]!.url);
    }
  }, [filteredPages, selectedPageUrl]);

  const selectedPage =
    filteredPages.find((page) => page.url === selectedPageUrl) ?? filteredPages[0] ?? null;

  return {
    loading: monitoringQuery.isLoading && !monitoring,
    unavailable: !monitoring && !monitoringQuery.isLoading,
    error: monitoringQuery.error instanceof Error ? monitoringQuery.error.message : null,
    projectName: monitoring?.project.name ?? "",
    search,
    setSearch,
    selectedModelIds,
    allModelsSelected,
    modelOptions,
    toggleModel,
    selectedPage,
    selectedPageUrl,
    setSelectedPageUrl,
    filteredPages,
    hasPages: pages.length > 0,
    metrics: panelModel?.metrics ?? null,
    modelLeaders: panelModel?.modelLeaders ?? [],
    citationSources: panelModel?.citationSources ?? [],
    opportunities: panelModel?.opportunities ?? [],
    refetch: async () => {
      await monitoringQuery.refetch();
    },
  };
}

export type PagesPanelViewModel = ReturnType<typeof usePagesPanelViewModel>;
export type PagesPanelMonitoringData = MonitoringData;
