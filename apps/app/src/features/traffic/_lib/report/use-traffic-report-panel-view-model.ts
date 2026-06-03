import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { appQueryKeys } from "@/lib/query-keys";
import {
  completeTrafficGA4OAuth,
  disconnectTrafficGA4Integration,
  listTrafficGA4OAuthProperties,
  TrafficRequestError,
  getTrafficQueryContext,
  loadTrafficPageData,
  normalizeTrafficPeriod,
  saveTrafficGA4Integration,
  selectTrafficGA4OAuthProperty,
  startTrafficGA4OAuth,
} from "./traffic-report-api";
import {
  claimGA4OAuthCallbackState,
  releaseGA4OAuthCallbackState,
} from "./ga4-oauth-callback-state";
import {
  formatDuration,
  formatInteger,
  formatPercent,
} from "./traffic-report-formatters";
import { buildTrafficReportViewData } from "./traffic-report-view-data";
import type {
  TrafficPeriod,
  TrafficReport,
  TrafficGA4LLMSetupResult,
  TrafficGA4OAuthProperty,
} from "./types";

type UseTrafficReportPanelViewModelInput = {
  apiBaseURL: string;
  routeSearch: string;
};

type PendingGA4OAuth = {
  projectId: string;
  organizationId: string;
  redirectUri: string;
  propertyId?: string;
  routeSearch: string;
};

export type TrafficKpiItem = {
  title: string;
  value: string;
  sub: string;
  description: string;
  tone: "primary" | "default";
};

export function shouldToastTrafficReportError({
  error,
  isConnected,
  isBusy = false,
}: {
  error: string | null;
  isConnected: boolean;
  isBusy?: boolean;
}): boolean {
  return Boolean(error) && isConnected && !isBusy;
}

function withPeriod(routeSearch: string, period: TrafficPeriod): string {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  params.set("period", period);
  const next = params.toString();
  return next ? `?${next}` : "";
}

function readSearchParam(routeSearch: string, key: string): string {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  return new URLSearchParams(normalized).get(key)?.trim() ?? "";
}

const pendingGA4OAuthStorageKey = "traffic.ga4.oauth.pending";

function getOAuthRedirectURI(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return `${window.location.origin}${window.location.pathname}`;
}

function savePendingGA4OAuth(value: PendingGA4OAuth) {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.setItem(pendingGA4OAuthStorageKey, JSON.stringify(value));
}

function readPendingGA4OAuth(): PendingGA4OAuth | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = window.sessionStorage.getItem(pendingGA4OAuthStorageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<PendingGA4OAuth>;
    if (!value.projectId || !value.organizationId || !value.redirectUri) {
      return null;
    }
    return {
      projectId: value.projectId,
      organizationId: value.organizationId,
      redirectUri: value.redirectUri,
      propertyId: value.propertyId ?? "",
      routeSearch: value.routeSearch ?? "",
    };
  } catch {
    return null;
  }
}

function clearPendingGA4OAuth() {
  if (typeof window === "undefined") {
    return;
  }
  window.sessionStorage.removeItem(pendingGA4OAuthStorageKey);
}

function clearOAuthCallbackParams(restoredSearch = "") {
  if (typeof window === "undefined") {
    return;
  }
  const url = new URL(window.location.href);
  if (restoredSearch) {
    url.search = restoredSearch;
  } else {
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    url.searchParams.delete("scope");
    url.searchParams.delete("authuser");
    url.searchParams.delete("prompt");
  }
  window.history.replaceState(window.history.state, "", url.toString());
  window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
}

function isAbortError(err: unknown): boolean {
  return err instanceof Error && err.name === "AbortError";
}

function toTrafficErrorMessage(err: unknown): string | null {
  if (!err || isAbortError(err)) {
    return null;
  }
  if (err instanceof TrafficRequestError && err.status === 400) {
    return "GA4 n'est pas encore configuré pour ce projet.";
  }
  if (err instanceof TrafficRequestError && err.scope === "traffic" && err.status === 503) {
    return err.message;
  }
  return "Impossible de charger le rapport Traffic.";
}

function ga4LLMSetupToastDescription(setup: TrafficGA4LLMSetupResult | null): string {
  if (!setup) {
    return "Le tracking LLM GA4 sera disponible après sélection d'une propriété.";
  }
  if (setup.setupStatus === "success") {
    return "Channel group Default + AI et canal AI configurés.";
  }
  if (setup.setupStatus === "partial_success") {
    return "Une partie du tracking LLM GA4 a été configurée. Vérifie les détails dans la carte GA4.";
  }
  return "Le tracking LLM GA4 n'a pas pu être configuré automatiquement.";
}

function buildKpis(report: TrafficReport | null): TrafficKpiItem[] {
  const summary = report?.summary;
  return [
    {
      title: "Visites IA détectées",
      value: formatInteger(summary?.totalTrafficSessions ?? 0),
      sub: `${formatPercent(summary?.trafficShareOfTotal ?? 0)} de toutes les visites GA4`,
      description: "Sessions GA4 dont la source ou le référent permet d'identifier un moteur génératif, par exemple ChatGPT ou Perplexity.",
      tone: "primary",
    },
    {
      title: "Taux d'engagement",
      value: formatPercent(summary?.trafficEngagementRate ?? 0),
      sub: `${formatInteger(summary?.trafficEngagedSessions ?? 0)} sessions engagées`,
      description: "Part des visites IA détectées considérées comme engagées par GA4: durée significative, conversion ou au moins deux pages vues.",
      tone: "default",
    },
    {
      title: "Conversions",
      value: formatInteger(summary?.trafficConversions ?? 0),
      sub: `${formatPercent(summary?.trafficConversionRate ?? 0)} de conversion`,
      description: "Événements marqués comme conversions ou key events dans GA4 pendant ces visites IA détectées.",
      tone: "default",
    },
    {
      title: "Durée moyenne des visites",
      value: formatDuration(summary?.trafficAvgSessionSeconds ?? 0),
      sub: `${formatPercent(summary?.trafficBounceRate ?? 0)} rebond`,
      description: "Durée moyenne d'une visite IA détectée, calculée depuis la métrique GA4 de durée moyenne de session.",
      tone: "default",
    },
  ];
}

export function useTrafficReportPanelViewModel({
  apiBaseURL,
  routeSearch,
}: UseTrafficReportPanelViewModelInput) {
  const initialPeriod = useMemo(
    () => getTrafficQueryContext(routeSearch).period,
    [routeSearch],
  );
  const [period, setPeriod] = useState<TrafficPeriod>(initialPeriod);
  const [propertyId, setPropertyId] = useState("");
  const [serviceAccountJSON, setServiceAccountJSON] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [oauthProperties, setOAuthProperties] = useState<TrafficGA4OAuthProperty[]>([]);
  const [selectedOAuthPropertyId, setSelectedOAuthPropertyId] = useState("");
  const [oauthPropertiesLoading, setOAuthPropertiesLoading] = useState(false);
  const [oauthPropertiesLoadedForProject, setOAuthPropertiesLoadedForProject] = useState("");
  const [oauthHandledState, setOAuthHandledState] = useState("");
  const [trafficSearchDraft, setTrafficSearchDraft] = useState("");
  const [trafficSearch, setTrafficSearch] = useState("");
  const [trafficEngine, setTrafficEngine] = useState("all");
  const [sourcePage, setSourcePage] = useState(1);
  const [topPagesPage, setTopPagesPage] = useState(1);
  const [llmSetup, setLLMSetup] = useState<TrafficGA4LLMSetupResult | null>(null);
  const [saving, setSaving] = useState(false);
  const showFormError = useCallback((message: string) => {
    setFormError(message);
    pushErrorToast(new Error(message), message);
  }, []);
  const showCaughtFormError = useCallback(
    (err: unknown, fallback: string) => {
      showFormError(err instanceof Error ? err.message : fallback);
    },
    [showFormError],
  );

  useEffect(() => {
    setPeriod(initialPeriod);
  }, [initialPeriod]);
  const effectiveRouteSearch = useMemo(
    () => withPeriod(routeSearch, period),
    [period, routeSearch],
  );
  const queryContext = useMemo(
    () => getTrafficQueryContext(effectiveRouteSearch),
    [effectiveRouteSearch],
  );

  const query = useQuery({
    queryKey: appQueryKeys.traffic(
      apiBaseURL,
      queryContext.projectId,
      queryContext.organizationId,
      period,
      trafficSearch,
      trafficEngine,
    ),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) =>
      loadTrafficPageData(apiBaseURL, effectiveRouteSearch, {
        signal,
        search: trafficSearch,
        engine: trafficEngine,
      }),
  });

  const refresh = useCallback(async () => {
    await query.refetch();
  }, [query]);

  const updatePeriod = useCallback((value: string) => {
    setPeriod(normalizeTrafficPeriod(value));
    setSourcePage(1);
    setTopPagesPage(1);
  }, []);

  const updateTrafficSearchDraft = useCallback((value: string) => {
    setTrafficSearchDraft(value);
  }, []);

  const submitTrafficSearch = useCallback(() => {
    setTrafficSearch(trafficSearchDraft.trim());
    setSourcePage(1);
    setTopPagesPage(1);
  }, [trafficSearchDraft]);

  const updateTrafficEngine = useCallback((value: string) => {
    setTrafficEngine(value || "all");
    setSourcePage(1);
    setTopPagesPage(1);
  }, []);

  const result = query.data;
  const report = result?.report ?? null;
  const integration = result?.integration ?? null;
  const viewData = useMemo(
    () => {
      const sources = report?.bySource ?? [];
      const topPages = report?.topPages ?? [];
      const timeseries = report?.timeseries ?? [];
      return buildTrafficReportViewData({
        sources,
        topPages,
        timeseries,
        filters: {
          sourcePage,
          topPagesPage,
        },
      });
    },
    [report?.bySource, report?.timeseries, report?.topPages, sourcePage, topPagesPage],
  );
  const hasData = (report?.summary.totalTrafficSessions ?? 0) > 0;
  const isConnected = integration?.ga4.isConnected === true;
  const hasOAuthToken = integration?.ga4.hasOAuthToken === true;
  const authMode = integration?.ga4.authMode ?? "";

  useEffect(() => {
    setPropertyId(integration?.ga4.propertyId ?? "");
  }, [integration?.ga4.propertyId]);

  useEffect(() => {
    setLLMSetup(null);
  }, [result?.projectId]);

  useEffect(() => {
    const propertyIds = new Set(oauthProperties.map((item) => item.propertyId));
    const connectedPropertyId = integration?.ga4.propertyId ?? "";
    const nextPropertyId = propertyIds.has(connectedPropertyId)
      ? connectedPropertyId
      : oauthProperties[0]?.propertyId ?? "";
    setSelectedOAuthPropertyId((current) =>
      current && propertyIds.has(current) ? current : nextPropertyId,
    );
  }, [integration?.ga4.propertyId, oauthProperties]);

  const loadOAuthProperties = useCallback(async (options?: { showToast?: boolean }) => {
    if (!result?.projectId || !result.organizationId) {
      return;
    }
    const projectKey = `${result.projectId}:${result.organizationId}`;
    setOAuthPropertiesLoading(true);
    setFormError(null);
    try {
      const properties = await listTrafficGA4OAuthProperties(
        apiBaseURL,
        result.projectId,
        result.organizationId,
      );
      setOAuthProperties(properties);
      setOAuthPropertiesLoadedForProject(projectKey);
      if (options?.showToast) {
        pushSuccessToast("Propriétés GA4 actualisées.");
      }
    } catch (err) {
      setOAuthPropertiesLoadedForProject(projectKey);
      if (options?.showToast) {
        showCaughtFormError(err, "Impossible de charger les propriétés GA4.");
      } else {
        setFormError(err instanceof Error ? err.message : "Impossible de charger les propriétés GA4.");
      }
    } finally {
      setOAuthPropertiesLoading(false);
    }
  }, [apiBaseURL, result, showCaughtFormError]);

  useEffect(() => {
    if (!hasOAuthToken || !result?.projectId || !result.organizationId) {
      return;
    }
    const projectKey = `${result.projectId}:${result.organizationId}`;
    if (oauthPropertiesLoadedForProject === projectKey) {
      return;
    }
    void loadOAuthProperties();
  }, [
    hasOAuthToken,
    loadOAuthProperties,
    oauthPropertiesLoadedForProject,
    result?.organizationId,
    result?.projectId,
  ]);

  useEffect(() => {
    const code = readSearchParam(routeSearch, "code");
    const state = readSearchParam(routeSearch, "state");
    const pendingOAuth = readPendingGA4OAuth();
    const projectId = pendingOAuth?.projectId ?? result?.projectId ?? "";
    const organizationId = pendingOAuth?.organizationId ?? result?.organizationId ?? "";
    const redirectUri = pendingOAuth?.redirectUri ?? getOAuthRedirectURI();
    const callbackPropertyId = pendingOAuth?.propertyId ?? propertyId;
    if (!code || !state || state === oauthHandledState || !projectId || !organizationId) {
      return;
    }
    if (!claimGA4OAuthCallbackState(state)) {
      return;
    }

    setOAuthHandledState(state);
    setSaving(true);
    setFormError(null);
    void completeTrafficGA4OAuth(apiBaseURL, {
      projectId,
      organizationId,
      code,
      state,
      redirectUri,
      propertyId: callbackPropertyId,
    })
      .then(async (response) => {
        setOAuthProperties(response.properties);
        setLLMSetup(response.llmSetup);
        clearPendingGA4OAuth();
        clearOAuthCallbackParams(pendingOAuth?.routeSearch ?? "");
        await query.refetch();
        pushSuccessToast(
          "Google Analytics connecté.",
          ga4LLMSetupToastDescription(response.llmSetup),
        );
      })
      .catch((err) => {
        releaseGA4OAuthCallbackState(state);
        clearOAuthCallbackParams(pendingOAuth?.routeSearch ?? "");
        clearPendingGA4OAuth();
        showCaughtFormError(
          err,
          "Impossible de terminer la connexion Google Analytics.",
        );
      })
      .finally(() => {
        setSaving(false);
      });
  }, [
    apiBaseURL,
    oauthHandledState,
    propertyId,
    query,
    result,
    routeSearch,
    showCaughtFormError,
  ]);

  const connect = useCallback(async () => {
    if (!result?.projectId || !result.organizationId) {
      showFormError("Sélectionne un projet avant de connecter GA4.");
      return;
    }
    if (propertyId.trim() === "" || serviceAccountJSON.trim() === "") {
      showFormError("Renseigne le Property ID et le JSON du service account.");
      return;
    }
    setLLMSetup(null);
    setSaving(true);
    setFormError(null);
    try {
      const response = await saveTrafficGA4Integration(apiBaseURL, {
        projectId: result.projectId,
        organizationId: result.organizationId,
        propertyId,
        serviceAccountJSON,
      });
      setLLMSetup(response.llmSetup);
      setServiceAccountJSON("");
      await query.refetch();
      pushSuccessToast(
        "Google Analytics connecté.",
        ga4LLMSetupToastDescription(response.llmSetup),
      );
    } catch (err) {
      showCaughtFormError(err, "Impossible de connecter GA4 pour ce projet.");
    } finally {
      setSaving(false);
    }
  }, [apiBaseURL, propertyId, query, result, serviceAccountJSON, showCaughtFormError, showFormError]);

  const startOAuth = useCallback(async () => {
    if (!result?.projectId || !result.organizationId) {
      showFormError("Sélectionne un projet avant de connecter Google Analytics.");
      return;
    }
    const redirectUri = getOAuthRedirectURI();
    if (!redirectUri) {
      showFormError("Impossible de préparer la redirection Google Analytics.");
      return;
    }
    setLLMSetup(null);
    setSaving(true);
    setFormError(null);
    try {
      const response = await startTrafficGA4OAuth(apiBaseURL, {
        projectId: result.projectId,
        organizationId: result.organizationId,
        redirectUri,
      });
      if (!response.authorizationUrl) {
        throw new Error("Google Analytics n'a pas retourné d'URL de connexion.");
      }
      savePendingGA4OAuth({
        projectId: result.projectId,
        organizationId: result.organizationId,
        redirectUri,
        propertyId: propertyId.trim(),
        routeSearch,
      });
      window.location.assign(response.authorizationUrl);
    } catch (err) {
      showCaughtFormError(
        err,
        "Impossible de démarrer la connexion Google Analytics.",
      );
      setSaving(false);
    }
  }, [apiBaseURL, propertyId, result, routeSearch, showCaughtFormError, showFormError]);

  const refreshOAuthProperties = useCallback(async () => {
    await loadOAuthProperties({ showToast: true });
  }, [loadOAuthProperties]);

  const selectOAuthProperty = useCallback(async () => {
    if (!result?.projectId || !result.organizationId || !selectedOAuthPropertyId) {
      showFormError("Sélectionne une propriété GA4.");
      return;
    }
    setLLMSetup(null);
    setSaving(true);
    setFormError(null);
    try {
      const response = await selectTrafficGA4OAuthProperty(apiBaseURL, {
        projectId: result.projectId,
        organizationId: result.organizationId,
        propertyId: selectedOAuthPropertyId,
      });
      setLLMSetup(response.llmSetup);
      await query.refetch();
      pushSuccessToast(
        "Propriété GA4 sélectionnée.",
        ga4LLMSetupToastDescription(response.llmSetup),
      );
    } catch (err) {
      showCaughtFormError(err, "Impossible de sélectionner cette propriété GA4.");
    } finally {
      setSaving(false);
    }
  }, [apiBaseURL, query, result, selectedOAuthPropertyId, showCaughtFormError, showFormError]);

  const disconnect = useCallback(async () => {
    if (!result?.projectId || !result.organizationId) {
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      await disconnectTrafficGA4Integration(
        apiBaseURL,
        result.projectId,
        result.organizationId,
      );
      setServiceAccountJSON("");
      setOAuthProperties([]);
      setSelectedOAuthPropertyId("");
      setOAuthPropertiesLoadedForProject("");
      setLLMSetup(null);
      await query.refetch();
      pushSuccessToast("Google Analytics déconnecté.");
    } catch (err) {
      showCaughtFormError(err, "Impossible de déconnecter GA4 pour ce projet.");
    } finally {
      setSaving(false);
    }
  }, [apiBaseURL, query, result, showCaughtFormError]);

  return {
    report,
    integration,
    isConnected,
    authMode,
    hasOAuthToken,
    llmSetup,
    period,
    setPeriod: updatePeriod,
    projectName: result?.projectName ?? "",
    propertyId: report?.propertyId || integration?.ga4.propertyId || "",
    dateRange: report?.dateRange ?? null,
    generatedAt: report?.generatedAt ?? "",
    loading: query.isLoading || (query.isFetching && !query.data),
    refreshing: query.isFetching,
    error: result?.reportError ?? toTrafficErrorMessage(query.error),
    formError,
    saving,
    form: {
      propertyId,
      serviceAccountJSON,
      setPropertyId,
      setServiceAccountJSON,
    },
    oauth: {
      properties: oauthProperties,
      selectedPropertyId: selectedOAuthPropertyId,
      loadingProperties: oauthPropertiesLoading,
      setSelectedPropertyId: setSelectedOAuthPropertyId,
      start: startOAuth,
      refreshProperties: refreshOAuthProperties,
      selectProperty: selectOAuthProperty,
    },
    hasData,
    kpis: buildKpis(report),
    filters: {
      search: trafficSearchDraft,
      engine: trafficEngine,
      availableEngines:
        trafficEngine === "all" || viewData.availableEngines.includes(trafficEngine)
          ? viewData.availableEngines
          : [trafficEngine, ...viewData.availableEngines],
      searchPending: trafficSearchDraft.trim() !== trafficSearch,
      setSearch: updateTrafficSearchDraft,
      submitSearch: submitTrafficSearch,
      setEngine: updateTrafficEngine,
    },
    sources: viewData.sources.items,
    sourcePagination: {
      page: viewData.sources.page,
      totalPages: viewData.sources.totalPages,
      totalItems: viewData.sources.totalItems,
      onPageChange: setSourcePage,
    },
    topPages: viewData.topPages.items,
    topPagesPagination: {
      page: viewData.topPages.page,
      totalPages: viewData.topPages.totalPages,
      totalItems: viewData.topPages.totalItems,
      onPageChange: setTopPagesPage,
    },
    timeseries: viewData.timeseries,
    refresh,
    connect,
    disconnect,
  };
}
