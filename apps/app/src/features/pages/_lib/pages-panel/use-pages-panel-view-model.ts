"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import {
  getMonitoringQueryContext,
  loadMonitoringData,
  type MonitoringData,
} from "@/lib/monitoring-data";
import { appQueryKeys } from "@/lib/query-keys";

import { buildPagesPanelViewModel } from "./page-insights";

type UsePagesPanelViewModelInput = {
  apiBaseURL: string;
  routeSearch: string;
};

export function usePagesPanelViewModel({
  apiBaseURL,
  routeSearch,
}: UsePagesPanelViewModelInput) {
  const queryContext = useMemo(() => getMonitoringQueryContext(routeSearch), [routeSearch]);
  const [search, setSearch] = useState("");
  const [selectedPageUrl, setSelectedPageUrl] = useState<string | null>(null);

  const monitoringQuery = useQuery({
    queryKey: appQueryKeys.monitoring(apiBaseURL, queryContext.projectId, queryContext.mode),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadMonitoringData(apiBaseURL, routeSearch, { signal }),
  });

  const monitoring = monitoringQuery.data?.data ?? null;
  const panelModel = useMemo(
    () => (monitoring ? buildPagesPanelViewModel(monitoring) : null),
    [monitoring],
  );
  const pages = panelModel?.pages ?? [];

  const filteredPages = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return pages;

    return pages.filter((page) =>
      [
        page.url,
        page.hostname,
        page.path,
        page.models.map((model) => model.label).join(" "),
        page.personas.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [pages, search]);

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
