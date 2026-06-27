import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  dismissToast,
  pushErrorToast,
  pushInfoToast,
  pushLoadingToast,
  pushSuccessToast,
} from "@/components/ui/toast-actions";
import {
  analyzeSelectedContentOptimizerRecords,
  getContentOptimizerSelectionDraft,
  getContentOptimizerCrawl,
  getContentOptimizerAnalysisRun,
  getLatestContentOptimizerCrawl,
  getProjectSummary,
  saveContentOptimizerSelectionDraft,
  startContentOptimizerCrawl,
  type ContentOptimizerCrawlRecord,
  type ContentOptimizerCrawlResult,
} from "../content-optimizer-api";
import { loadBillingEntitlements } from "@/shared/billing";
import { normalizeBillingPlan } from "@/shared/billing-plan";
import {
  readOrganizationIdFromSearch,
  readProjectTokenFromSearch,
  readSelectedOrganizationPublicID,
  readSelectedProjectID,
} from "@/shared/selection";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type UseContentOptimizerViewModelInput = {
  apiBaseURL: string;
  routeSearch: string;
};

type CrawlPhase = "idle" | "discovering" | "review" | "crawling" | "completed";
type ActiveJobKind = "discover" | "crawl";
type CrawlRequestOptions = {
  limit?: number;
  includePatterns?: string[];
};

const CRAWL_POLL_INTERVAL_MS = 2000;
const CRAWL_PROGRESS_TOAST_ID = "content-crawl-in-progress";
const DEFAULT_SELECTED_CRAWL_LIMIT = 10;

const TERMINAL_STATUSES = new Set([
  "completed",
  "partially_completed",
  "cancelled_due_to_timeout",
  "cancelled_due_to_limits",
  "cancelled_by_user",
  "errored",
]);

function isValidHTTPURL(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATUSES.has(status);
}

function selectedCrawlLimitForPlan(plan: string | null): number | null {
  switch (normalizeBillingPlan(plan)) {
    case "starter":
    case "developer":
      return 10;
    case "growth":
      return 50;
    case "pro":
      return 200;
    case "agency-enterprise":
      return null;
    default:
      return DEFAULT_SELECTED_CRAWL_LIMIT;
  }
}

function pageURL(record: ContentOptimizerCrawlRecord): string {
  return record.url.trim();
}

function normalizeDiscoveryHostname(hostname: string): string {
  const normalized = hostname.trim().toLowerCase().replace(/\.+$/, "");
  if (normalized.startsWith("www.")) {
    return normalized.slice(4);
  }
  return normalized;
}

function matchesProjectDiscoveryDomain(url: string, projectWebsiteURL: string): boolean {
  try {
    const projectURL = new URL(projectWebsiteURL);
    const recordURL = new URL(url);
    return (
      normalizeDiscoveryHostname(recordURL.hostname) ===
      normalizeDiscoveryHostname(projectURL.hostname)
    );
  } catch {
    return false;
  }
}

function filterDiscoveryResultToProjectDomain(
  result: ContentOptimizerCrawlResult,
  projectWebsiteURL: string,
): ContentOptimizerCrawlResult {
  if (!isValidHTTPURL(projectWebsiteURL)) {
    return result;
  }

  const records = result.records.filter((record) =>
    matchesProjectDiscoveryDomain(pageURL(record), projectWebsiteURL),
  );

  return {
    ...result,
    total: records.length,
    finished: records.length,
    records,
  };
}

export function useContentOptimizerViewModel({
  apiBaseURL,
  routeSearch,
}: UseContentOptimizerViewModelInput) {
  const { t } = useScopedI18n("crawler-panel");
  const projectId = useMemo(
    () => readProjectTokenFromSearch(routeSearch) || readSelectedProjectID(),
    [routeSearch],
  );
  const organizationId = useMemo(
    () =>
      readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationPublicID(),
    [routeSearch],
  );
  const projectScopeKey = useMemo(
    () => `${organizationId.trim()}|${projectId.trim()}`,
    [organizationId, projectId],
  );
  const hasProjectScope =
    apiBaseURL.trim() !== "" &&
    projectId.trim() !== "" &&
    organizationId.trim() !== "";

  const [projectWebsiteURL, setProjectWebsiteURL] = useState("");
  const [projectName, setProjectName] = useState("");
  const [phase, setPhase] = useState<CrawlPhase>("idle");
  const [activeJobId, setActiveJobId] = useState("");
  const [activeJobKind, setActiveJobKind] = useState<ActiveJobKind | null>(
    null,
  );
  const [discoveryResult, setDiscoveryResult] =
    useState<ContentOptimizerCrawlResult | null>(null);
  const [crawlResult, setCrawlResult] =
    useState<ContentOptimizerCrawlResult | null>(null);
  const [selectedURLs, setSelectedURLs] = useState<Set<string>>(
    () => new Set(),
  );
  const [selectedResultURL, setSelectedResultURL] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loadingLatest, setLoadingLatest] = useState(false);
  const [discoveryLoadedKey, setDiscoveryLoadedKey] = useState("");
  const [hydratingProjectScope, setHydratingProjectScope] = useState(true);
  const [projectSummaryResolved, setProjectSummaryResolved] = useState(false);
  const [pendingReviewSelectedURLs, setPendingReviewSelectedURLs] =
    useState<Set<string> | null>(null);
  const [reviewingURLSelection, setReviewingURLSelection] = useState(false);
  const [selectedCrawlLimit, setSelectedCrawlLimit] = useState<number | null>(
    DEFAULT_SELECTED_CRAWL_LIMIT,
  );
  const [selectedCrawlLimitResolved, setSelectedCrawlLimitResolved] =
    useState(false);
  const [diagnosticAnalysisRunning, setDiagnosticAnalysisRunning] = useState(false);

  const discoveredPages = useMemo(
    () =>
      (discoveryResult?.records ?? []).filter(
        (record) => pageURL(record) !== "",
      ),
    [discoveryResult],
  );
  const crawlRecords = crawlResult?.records ?? [];
  const selectedResult =
    crawlRecords.find((record) => record.url === selectedResultURL) ??
    crawlRecords[0] ??
    null;
  const selectedCount = selectedURLs.size;
  const discoverProgress = discoveryResult?.total
    ? Math.round(
        (Math.min(discoveryResult.finished, discoveryResult.total) /
          discoveryResult.total) *
          100,
      )
    : phase === "discovering"
      ? 8
      : 0;
  const crawlProgress = crawlResult?.total
    ? Math.round(
        (Math.min(crawlResult.finished, crawlResult.total) /
          crawlResult.total) *
          100,
      )
    : phase === "crawling"
      ? 8
      : 0;

  useEffect(() => {
    if (phase !== "crawling") {
      dismissToast(CRAWL_PROGRESS_TOAST_ID);
      return;
    }
    const total = Math.max(1, crawlResult?.total || selectedCount || 1);
    const completed = Math.min(total, crawlResult?.finished || 0);
    pushLoadingToast(
      t("crawlProgressToast", { completed, total }),
      t("crawlRemainingToast", { count: Math.max(0, total - completed) }),
      undefined,
      CRAWL_PROGRESS_TOAST_ID,
    );
  }, [crawlResult?.finished, crawlResult?.total, phase, selectedCount, t]);
  const allDiscoveredSelected =
    discoveredPages.length > 0 &&
    discoveredPages.every((record) => selectedURLs.has(pageURL(record)));
  const canDiscover =
    apiBaseURL.trim() !== "" &&
    projectId.trim() !== "" &&
    isValidHTTPURL(projectWebsiteURL.trim()) &&
    phase !== "discovering" &&
    phase !== "crawling";
  const canCrawlSelected =
    (phase === "review" || phase === "completed") &&
    selectedCount > 0;
  const canReanalyze =
    canDiscover &&
    (selectedCount > 0 || crawlRecords.length > 0 || !crawlResult);

  const clearSelectionState = useCallback(() => {
    setSelectedURLs(new Set());
    setSelectedResultURL("");
  }, []);

  const showURLSelection = useCallback(() => {
    setReviewingURLSelection(true);
  }, []);

  const hideURLSelection = useCallback(() => {
    setReviewingURLSelection(false);
  }, []);

  const limitSelectionURLs = useCallback((urls: string[]): string[] => {
    const normalized = Array.from(new Set(urls.map((url) => url.trim()).filter(Boolean)));
    return selectedCrawlLimit === null
      ? normalized
      : normalized.slice(0, selectedCrawlLimit);
  }, [selectedCrawlLimit]);

  const showSelectedPlanLimitIfNeeded = useCallback((totalCount: number) => {
    if (selectedCrawlLimit !== null && totalCount > selectedCrawlLimit) {
      setError(t("selectedPlanLimitError", { count: selectedCrawlLimit }));
    }
  }, [selectedCrawlLimit, t]);

  const applySelectedRecords = useCallback((records: ContentOptimizerCrawlRecord[]) => {
    const allURLs = records.map(pageURL).filter(Boolean);
    const selectedURLs = limitSelectionURLs(allURLs);
    setSelectedURLs(new Set(selectedURLs));
    setSelectedResultURL(selectedURLs[0] ?? "");
    showSelectedPlanLimitIfNeeded(new Set(allURLs).size);
  }, [limitSelectionURLs, showSelectedPlanLimitIfNeeded]);

  const clearResultsState = useCallback(() => {
    setDiscoveryResult(null);
    setCrawlResult(null);
    clearSelectionState();
  }, [clearSelectionState]);

  useLayoutEffect(() => {
    setProjectWebsiteURL("");
    setProjectName("");
    setPhase("idle");
    setActiveJobId("");
    setActiveJobKind(null);
    clearResultsState();
    setError(null);
    setLoadingLatest(true);
    setDiscoveryLoadedKey("");
    setHydratingProjectScope(true);
    setProjectSummaryResolved(false);
    setPendingReviewSelectedURLs(null);
    setSelectedCrawlLimitResolved(false);
    hideURLSelection();
  }, [clearResultsState, hideURLSelection, projectScopeKey]);

  useEffect(() => {
    if (hasProjectScope) {
      return;
    }

    setLoadingLatest(false);
    setHydratingProjectScope(false);
    setProjectSummaryResolved(false);
    setSelectedCrawlLimit(DEFAULT_SELECTED_CRAWL_LIMIT);
    setSelectedCrawlLimitResolved(true);
  }, [hasProjectScope]);

  useEffect(() => {
    if (!hasProjectScope) {
      setSelectedCrawlLimit(DEFAULT_SELECTED_CRAWL_LIMIT);
      setSelectedCrawlLimitResolved(true);
      return;
    }

    let cancelled = false;

    async function loadSelectedCrawlLimit() {
      setSelectedCrawlLimitResolved(false);
      try {
        const entitlements = await loadBillingEntitlements(apiBaseURL, organizationId);
        if (cancelled) return;
        setSelectedCrawlLimit(selectedCrawlLimitForPlan(entitlements.plan));
      } catch {
        if (cancelled) return;
        setSelectedCrawlLimit(DEFAULT_SELECTED_CRAWL_LIMIT);
      } finally {
        if (!cancelled) {
          setSelectedCrawlLimitResolved(true);
        }
      }
    }

    void loadSelectedCrawlLimit();

    return () => {
      cancelled = true;
    };
  }, [apiBaseURL, hasProjectScope, organizationId]);

  useEffect(() => {
    if (selectedCrawlLimit === null || selectedURLs.size <= selectedCrawlLimit) {
      return;
    }

    const limitedURLs = Array.from(selectedURLs).slice(0, selectedCrawlLimit);
    setSelectedURLs(new Set(limitedURLs));
    if (!limitedURLs.includes(selectedResultURL)) {
      setSelectedResultURL(limitedURLs[0] ?? "");
    }
    setError(t("selectedPlanLimitError", { count: selectedCrawlLimit }));
  }, [selectedCrawlLimit, selectedResultURL, selectedURLs, t]);

  useEffect(() => {
    if (!hasProjectScope) {
      return;
    }

    let cancelled = false;

    async function loadProjectSummary() {
      try {
        setLoadingLatest(true);
        const projectSummary = await getProjectSummary(apiBaseURL, {
          projectId,
          organizationId,
        });
        if (cancelled) return;
        setProjectWebsiteURL(projectSummary.websiteUrl);
        setProjectName(projectSummary.name);
        setProjectSummaryResolved(true);
      } catch (nextError) {
        if (cancelled) return;
        setError(
          nextError instanceof Error
            ? nextError.message
            : t("loadProjectError"),
        );
        setProjectSummaryResolved(true);
        setHydratingProjectScope(false);
      } finally {
        if (!cancelled) {
          setLoadingLatest(false);
        }
      }
    }

    void loadProjectSummary();

    return () => {
      cancelled = true;
    };
  }, [apiBaseURL, hasProjectScope, organizationId, projectId, t]);

  useEffect(() => {
    if (
      !hasProjectScope ||
      !projectSummaryResolved ||
      !selectedCrawlLimitResolved ||
      discoveryLoadedKey === projectScopeKey ||
      phase === "discovering" ||
      phase === "crawling"
    ) {
      return;
    }

    if (!projectWebsiteURL.trim()) {
      setDiscoveryLoadedKey(projectScopeKey);
      setHydratingProjectScope(false);
      return;
    }

    if (!isValidHTTPURL(projectWebsiteURL)) {
      setDiscoveryLoadedKey(projectScopeKey);
      setHydratingProjectScope(false);
      return;
    }

    let cancelled = false;

    async function hydrateProjectReviewState() {
      let latestResult: ContentOptimizerCrawlResult | null = null;
      try {
        const [latest, selectionDraft] = await Promise.all([
          getLatestContentOptimizerCrawl(apiBaseURL, {
            projectId,
            organizationId,
          }),
          getContentOptimizerSelectionDraft(apiBaseURL, {
            projectId,
            organizationId,
          }),
        ]);
        if (cancelled) return;

        latestResult = latest?.result.records.length ? latest.result : null;
        if (latest && !isTerminalStatus(latest.result.status)) {
          setDiscoveryLoadedKey(projectScopeKey);
          setDiscoveryResult(null);
          setCrawlResult(latest.result);
          setActiveJobId(latest.jobId || latest.result.id);
          setActiveJobKind("crawl");
          hideURLSelection();
          setPhase("crawling");
          setHydratingProjectScope(false);
          return;
        }

        if (selectionDraft?.result.records.length) {
          const selectedDraftURLs = limitSelectionURLs(selectionDraft.selectedUrls);
          setDiscoveryLoadedKey(projectScopeKey);
          setDiscoveryResult(selectionDraft.result);
          setCrawlResult(latestResult);
          setSelectedURLs(new Set(selectedDraftURLs));
          setSelectedResultURL(selectedDraftURLs[0] ?? selectionDraft.result.records[0]?.url ?? "");
          showURLSelection();
          setPhase("review");
          setHydratingProjectScope(false);
          return;
        }

        if (latest?.result.records.length) {
          setDiscoveryLoadedKey(projectScopeKey);
          setDiscoveryResult(null);
          setCrawlResult(latest.result);
          applySelectedRecords(latest.result.records);
          hideURLSelection();
          setPhase("completed");
          setHydratingProjectScope(false);
          return;
        }
      } catch {
        if (cancelled) return;
      }

      if (cancelled) return;
      setDiscoveryLoadedKey(projectScopeKey);
      setHydratingProjectScope(false);
    }

    void hydrateProjectReviewState();

    return () => {
      cancelled = true;
    };
  }, [
    apiBaseURL,
    applySelectedRecords,
    discoveryLoadedKey,
    hasProjectScope,
    hideURLSelection,
    limitSelectionURLs,
    organizationId,
    phase,
    projectId,
    projectScopeKey,
    projectSummaryResolved,
    projectWebsiteURL,
    selectedCrawlLimit,
    selectedCrawlLimitResolved,
    showURLSelection,
    showSelectedPlanLimitIfNeeded,
  ]);

  useEffect(() => {
    if (
      !hasProjectScope ||
      !reviewingURLSelection ||
      !discoveryResult?.records.length ||
      discoveryLoadedKey !== projectScopeKey
    ) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      void saveContentOptimizerSelectionDraft(
        apiBaseURL,
        {
          projectId,
          organizationId,
          jobId: discoveryResult.id,
          selectedUrls: Array.from(selectedURLs),
          result: discoveryResult,
        },
        controller.signal,
      ).catch(() => undefined);
    }, 500);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [
    apiBaseURL,
    discoveryLoadedKey,
    discoveryResult,
    hasProjectScope,
    organizationId,
    projectId,
    projectScopeKey,
    reviewingURLSelection,
    selectedURLs,
  ]);

  const discoverMutation = useMutation({
    mutationFn: () =>
      startContentOptimizerCrawl(apiBaseURL, {
        projectId,
        organizationId,
        url: projectWebsiteURL,
        depth: 25,
        render: false,
      }),
    onMutate: () => {
      const previousDiscovery = discoveryResult;
      const previousPhase = phase;
      const toastId = pushLoadingToast(
        t("discoveryToastTitle"),
      );
      setError(null);
      setPhase("discovering");
      showURLSelection();
      setActiveJobId("");
      setActiveJobKind(null);
      if (!previousDiscovery || previousDiscovery.records.length === 0) {
        clearResultsState();
      }
      return { previousDiscovery, previousPhase, toastId };
    },
    onSuccess: (job, _variables, context) => {
      dismissToast(context?.toastId);
      pushInfoToast(
        t("backgroundAnalysisAcceptedTitle"),
        t("backgroundAnalysisAcceptedDescription"),
      );
      setActiveJobId(job.id);
      setActiveJobKind("discover");
      setDiscoveryResult({
        id: job.id,
        status: job.status,
        total: 0,
        finished: 0,
        records: [],
      });
    },
    onError: (nextError, _variables, context) => {
      dismissToast(context?.toastId);
      if (context?.previousDiscovery?.records.length) {
        setDiscoveryResult(context.previousDiscovery);
        showURLSelection();
        setPhase(context.previousPhase === "completed" ? "completed" : "review");
      } else {
        hideURLSelection();
        setPhase("idle");
      }
      setError(
        nextError instanceof Error
          ? nextError.message
          : t("analyzeSiteError"),
      );
    },
  });

  const crawlMutation = useMutation({
    mutationFn: (options?: CrawlRequestOptions) => {
      const includePatterns =
        options?.includePatterns ?? Array.from(selectedURLs);
      const requestedLimit = options?.limit ?? Math.max(includePatterns.length, 1);
      const limit =
        selectedCrawlLimit === null
          ? requestedLimit
          : Math.min(requestedLimit, selectedCrawlLimit);
      const effectiveIncludePatterns =
        selectedCrawlLimit === null
          ? includePatterns
          : includePatterns.slice(0, selectedCrawlLimit);

      return startContentOptimizerCrawl(apiBaseURL, {
        projectId,
        organizationId,
        url: projectWebsiteURL,
        limit,
        depth: 1,
        render: false,
        includePatterns: effectiveIncludePatterns,
      });
    },
    onMutate: (options) => {
      const requestedLimit =
        options?.limit ??
        Math.max((options?.includePatterns ?? Array.from(selectedURLs)).length, 1);
      const limit =
        selectedCrawlLimit === null
          ? requestedLimit
          : Math.min(requestedLimit, selectedCrawlLimit);
      setError(null);
      setPhase("crawling");
      hideURLSelection();
      setActiveJobId("");
      setActiveJobKind(null);
      setCrawlResult(null);
      setSelectedResultURL("");
      return { limit };
    },
    onSuccess: (job, _unusedOptions, context) => {
      void _unusedOptions;
      setActiveJobId(job.id);
      setActiveJobKind("crawl");
      setCrawlResult({
        id: job.id,
        status: job.status,
        total: context?.limit ?? selectedCount,
        finished: 0,
        records: [],
      });
      hideURLSelection();
    },
    onError: (nextError, _unusedOptions, context) => {
      void _unusedOptions;
      void context;
      setPhase("review");
      showURLSelection();
      setError(
        nextError instanceof Error
          ? nextError.message
          : t("launchCrawlError"),
      );
    },
  });

  useEffect(() => {
    if (!activeJobId || !activeJobKind) {
      return;
    }

    let cancelled = false;
    let pollTimeout: number | undefined;
    let pollingComplete = false;

    async function poll(): Promise<void> {
      try {
        const lightweight = await getContentOptimizerCrawl(apiBaseURL, {
          projectId,
          organizationId,
          jobId: activeJobId,
          analyze: false,
        });
        if (cancelled) return;

        if (lightweight.status === "completed") {
          const completed = await getContentOptimizerCrawl(apiBaseURL, {
            projectId,
            organizationId,
            jobId: activeJobId,
            analyze: false,
          });
          if (cancelled) return;

          if (activeJobKind === "discover") {
            const filteredCompleted = filterDiscoveryResultToProjectDomain(
              completed,
              projectWebsiteURL,
            );
            setDiscoveryResult(filteredCompleted);
            if (pendingReviewSelectedURLs?.size) {
              const discoveredURLs = new Set(
                filteredCompleted.records.map(pageURL).filter(Boolean),
              );
              const nextSelectedURLs = Array.from(pendingReviewSelectedURLs).filter(
                (url) => discoveredURLs.has(url),
              );
              if (nextSelectedURLs.length > 0) {
                const limitedSelectedURLs = limitSelectionURLs(nextSelectedURLs);
                setSelectedURLs(new Set(limitedSelectedURLs));
                setSelectedResultURL(limitedSelectedURLs[0] ?? "");
                showSelectedPlanLimitIfNeeded(nextSelectedURLs.length);
              } else {
                applySelectedRecords(filteredCompleted.records);
              }
            } else {
              applySelectedRecords(filteredCompleted.records);
            }
            setPendingReviewSelectedURLs(null);
            showURLSelection();
            setPhase("review");
          } else {
            const pendingAnalysis = { ...completed, analysisStatus: "pending" as const };
            setCrawlResult(pendingAnalysis);
            setDiscoveryResult(null);
            applySelectedRecords(completed.records);
            hideURLSelection();
            setPhase("completed");
          }
          setActiveJobKind(null);
          pollingComplete = true;
          return;
        }

        if (activeJobKind === "discover") {
          setDiscoveryResult(
            filterDiscoveryResultToProjectDomain(lightweight, projectWebsiteURL),
          );
          showURLSelection();
        } else {
          setCrawlResult(lightweight);
          hideURLSelection();
        }
        if (isTerminalStatus(lightweight.status)) {
          setActiveJobKind(null);
          pollingComplete = true;
          if (activeJobKind === "crawl") {
            setDiscoveryResult(null);
            hideURLSelection();
          }
          setPhase(activeJobKind === "discover" ? "review" : "completed");
        }
      } catch (nextError) {
        if (cancelled) return;
        setError(
          nextError instanceof Error
            ? nextError.message
            : t("readCrawlError"),
        );
        setActiveJobKind(null);
        pollingComplete = true;
        if (activeJobKind === "discover") {
          hideURLSelection();
          setPhase("idle");
        } else {
          showURLSelection();
          setPhase("review");
        }
      } finally {
        if (!cancelled && !pollingComplete) {
          pollTimeout = window.setTimeout(
            () => void poll(),
            CRAWL_POLL_INTERVAL_MS,
          );
        }
      }
    }

    void poll();

    return () => {
      cancelled = true;
      if (pollTimeout !== undefined) {
        window.clearTimeout(pollTimeout);
      }
    };
  }, [
    activeJobId,
    activeJobKind,
    applySelectedRecords,
    apiBaseURL,
    hideURLSelection,
    limitSelectionURLs,
    organizationId,
    pendingReviewSelectedURLs,
    projectId,
    projectWebsiteURL,
    showURLSelection,
    showSelectedPlanLimitIfNeeded,
    t,
  ]);

  function togglePage(nextURL: string, checked: boolean) {
    setSelectedURLs((current) => {
      const next = new Set(current);
      if (checked) {
        if (
          selectedCrawlLimit !== null &&
          !next.has(nextURL) &&
          next.size >= selectedCrawlLimit
        ) {
          setError(t("selectedPlanLimitError", { count: selectedCrawlLimit }));
          return current;
        }
        next.add(nextURL);
      } else {
        next.delete(nextURL);
      }
      return next;
    });
  }

  function toggleAllPages(checked: boolean) {
    if (!checked) {
      setSelectedURLs(new Set());
      return;
    }
    const urls = discoveredPages.map(pageURL).filter(Boolean);
    setSelectedURLs(new Set(limitSelectionURLs(urls)));
    showSelectedPlanLimitIfNeeded(new Set(urls).size);
  }

  function reset() {
    setPhase("idle");
    setActiveJobId("");
    setActiveJobKind(null);
    clearResultsState();
    hideURLSelection();
    setError(null);
  }

  function reviewSelection() {
    const lastAnalyzedURLs = new Set(
      (selectedURLs.size > 0
        ? Array.from(selectedURLs)
        : crawlRecords.map(pageURL)
      ).filter(Boolean),
    );

    if (phase === "completed" && canDiscover) {
      setPendingReviewSelectedURLs(lastAnalyzedURLs);
      showURLSelection();
      discoverMutation.mutate();
      return;
    }

    if (discoveryResult?.records.length) {
      showURLSelection();
      setPhase("review");
      return;
    }

    const reviewResult =
      crawlResult && crawlResult.records.length > 0
        ? {
            ...crawlResult,
            records: crawlResult.records,
            total: crawlResult.records.length,
            finished: crawlResult.records.length,
          }
        : null;

    if (!reviewResult) {
      showURLSelection();
      discoverMutation.mutate();
      return;
    }

    const reviewURLs = new Set(reviewResult.records.map(pageURL).filter(Boolean));
    const selectedReviewURLs = Array.from(lastAnalyzedURLs).filter((url) =>
      reviewURLs.has(url),
    );
    const fallbackReviewURLs = reviewResult.records.map(pageURL).filter(Boolean);
    const nextSelectedReviewURLs = limitSelectionURLs(
      selectedReviewURLs.length > 0 ? selectedReviewURLs : fallbackReviewURLs,
    );

    setDiscoveryResult(reviewResult);
    setSelectedURLs(new Set(nextSelectedReviewURLs));
    setSelectedResultURL(nextSelectedReviewURLs[0] ?? "");
    showSelectedPlanLimitIfNeeded(
      new Set(selectedReviewURLs.length > 0 ? selectedReviewURLs : fallbackReviewURLs).size,
    );
    showURLSelection();
    setPhase("review");
  }

  function showLatestContentCrawl() {
    if (!crawlResult?.records.length) {
      return;
    }
    hideURLSelection();
    setPhase("completed");
    setSelectedResultURL(crawlResult.records[0]?.url ?? "");
  }

  function reanalyze(options?: CrawlRequestOptions) {
    if (options || selectedCount > 0) {
      crawlMutation.mutate(options);
      return;
    }
    discoverMutation.mutate();
  }

  async function analyzeDiagnostics(model: {
    id: string;
    provider: string;
    providerModelId: string;
    creditCost: number;
  }, record: ContentOptimizerCrawlRecord) {
    if (diagnosticAnalysisRunning || !record.url) return;
    setDiagnosticAnalysisRunning(true);
    setError(null);
    setCrawlResult((current) => current ? { ...current, analysisStatus: "pending" } : current);
    const toastId = pushLoadingToast(
      t("analysisInProgress"),
      t("backgroundAnalysisAcceptedDescription"),
    );
    try {
      const run = await analyzeSelectedContentOptimizerRecords(apiBaseURL, {
        projectId,
        organizationId,
        records: [record],
        modelId: model.id,
        providerModelId: model.providerModelId,
        providerId: model.provider,
        creditCost: model.creditCost,
      });
      for (;;) {
        await new Promise((resolve) => window.setTimeout(resolve, CRAWL_POLL_INTERVAL_MS));
        const currentRun = await getContentOptimizerAnalysisRun(apiBaseURL, {
          runId: run.id,
          organizationId,
        });
        if (currentRun.status === "failed" || currentRun.status === "cancelled") {
          throw new Error(t("analyzeSiteError"));
        }
        if (currentRun.status === "completed") break;
      }
      const latest = await getLatestContentOptimizerCrawl(apiBaseURL, {
        projectId,
        organizationId,
      });
      if (latest?.result) {
        setCrawlResult(latest.result);
        applySelectedRecords(latest.result.records);
        setSelectedResultURL(record.url);
      }
      dismissToast(toastId);
      pushSuccessToast(t("analysisCompletedToastTitle"), t("analysisCompletedToastDescription"));
    } catch (analysisError) {
      dismissToast(toastId);
      setCrawlResult((current) => current ? { ...current, analysisStatus: "failed" } : current);
      setError(analysisError instanceof Error ? analysisError.message : t("analyzeSiteError"));
      pushErrorToast(analysisError, t("analyzeSiteError"));
    } finally {
      setDiagnosticAnalysisRunning(false);
    }
  }

  return {
    projectId,
    organizationId,
    projectName,
    projectWebsiteURL,
    setProjectWebsiteURL,
    phase,
    activeJobId,
    discoveryResult,
    crawlResult,
    discoveredPages,
    crawlRecords,
    reviewingURLSelection,
    selectedResult,
    selectedResultURL,
    setSelectedResultURL,
    selectedURLs,
    selectedCount,
    selectedCrawlLimit,
    hasLatestContentCrawl: crawlRecords.length > 0,
    discoverProgress,
    crawlProgress,
    allDiscoveredSelected,
    canDiscover,
    canCrawlSelected,
    canReanalyze,
    error,
    loadingLatest,
    hydratingProjectScope,
    discovering: phase === "discovering" || discoverMutation.isPending,
    crawling:
      phase === "crawling" ||
      crawlMutation.isPending,
    diagnosticAnalysisRunning,
    analyzeDiagnostics,
    discover: () => {
      discoverMutation.mutate();
    },
    crawlSelected: () => {
      crawlMutation.mutate(undefined);
    },
    reanalyze,
    reviewSelection,
    showLatestContentCrawl,
    togglePage,
    toggleAllPages,
    reset,
  };
}

export type ContentOptimizerViewModel = ReturnType<
  typeof useContentOptimizerViewModel
>;
