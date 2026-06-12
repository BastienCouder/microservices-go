import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";

import { pushWarningToast } from "@/components/ui/toast-actions";
import { appQueryKeys } from "@/lib/query-keys";
import { getBillingPlanLabel } from "@/shared/billing-plan";
import {
  analyzeSelectedContentOptimizerRecords,
  getContentOptimizerCrawl,
  getLatestContentOptimizerCrawl,
  getProjectSummary,
  startContentOptimizerCrawl,
  type ContentOptimizerCrawlRecord,
  type ContentOptimizerCrawlResult,
} from "../content-optimizer-api";
import { loadPromptQuotaUsage } from "@/features/prompts/_lib/prompt-quota";
import { loadBillingEntitlements } from "@/shared/billing";
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

const DISCOVERY_LIMIT = 100;
const DISCOVERY_STORAGE_KEY = "content-optimizer-discovery-cache";

const TERMINAL_STATUSES = new Set([
  "completed",
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

function pageURL(record: ContentOptimizerCrawlRecord): string {
  return record.url.trim();
}

function hasExtractedContent(record: ContentOptimizerCrawlRecord): boolean {
  return (
    Boolean(record.markdown?.trim()) ||
    Boolean(record.html?.trim()) ||
    record.json != null
  );
}

export function contentOptimizerCreditCost(limit: number): number {
  const normalizedLimit = Math.max(1, Math.floor(limit));
  if (normalizedLimit <= 10) return 10;
  if (normalizedLimit <= 50) return 35;
  if (normalizedLimit <= 200) return 100;
  return 100 + Math.ceil((normalizedLimit - 200) / 5);
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

type StoredDiscoveryEntry = {
  organizationId: string;
  projectId: string;
  result: ContentOptimizerCrawlResult;
  updatedAt: string;
};

function discoveryStorageKey(projectId: string, organizationId: string): string {
  return `${organizationId.trim()}|${projectId.trim()}`;
}

function readStoredDiscovery(
  projectId: string,
  organizationId: string,
  projectWebsiteURL: string,
): ContentOptimizerCrawlResult | null {
  if (typeof window === "undefined") {
    return null;
  }

  const storageKey = discoveryStorageKey(projectId, organizationId);
  const raw = window.localStorage.getItem(DISCOVERY_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, StoredDiscoveryEntry>;
    const entry = parsed[storageKey];
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const result = entry.result;
    if (!result || !Array.isArray(result.records)) {
      return null;
    }
    return filterDiscoveryResultToProjectDomain(result, projectWebsiteURL);
  } catch {
    return null;
  }
}

function writeStoredDiscovery(
  projectId: string,
  organizationId: string,
  projectWebsiteURL: string,
  result: ContentOptimizerCrawlResult | null,
) {
  if (typeof window === "undefined") {
    return;
  }

  const storageKey = discoveryStorageKey(projectId, organizationId);
  let nextCache: Record<string, StoredDiscoveryEntry> = {};

  try {
    const raw = window.localStorage.getItem(DISCOVERY_STORAGE_KEY);
    if (raw) {
      nextCache = JSON.parse(raw) as Record<string, StoredDiscoveryEntry>;
    }
  } catch {
    nextCache = {};
  }

  if (!result) {
    delete nextCache[storageKey];
  } else {
    const filteredResult = filterDiscoveryResultToProjectDomain(
      result,
      projectWebsiteURL,
    );
    nextCache[storageKey] = {
      organizationId: organizationId.trim(),
      projectId: projectId.trim(),
      result: filteredResult,
      updatedAt: new Date().toISOString(),
    };
  }

  window.localStorage.setItem(DISCOVERY_STORAGE_KEY, JSON.stringify(nextCache));
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

  const quotaQuery = useQuery({
    queryKey: appQueryKeys.promptQuota(apiBaseURL, organizationId, projectId),
    enabled: hasProjectScope,
    queryFn: () => loadPromptQuotaUsage(apiBaseURL, projectId, organizationId),
  });
  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, organizationId),
    enabled: apiBaseURL.trim() !== "" && organizationId.trim() !== "",
    queryFn: () => loadBillingEntitlements(apiBaseURL, organizationId),
  });

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

  const discoveredPages = useMemo(
    () =>
      (discoveryResult?.records ?? []).filter(
        (record) => pageURL(record) !== "",
      ),
    [discoveryResult],
  );
  const crawlRecords = crawlResult?.records ?? [];
  const selectedContentRecords = useMemo(() => {
    const sourceRecords =
      discoveredPages.length > 0 ? discoveredPages : crawlRecords;
    return sourceRecords.filter((record) => selectedURLs.has(pageURL(record)));
  }, [crawlRecords, discoveredPages, selectedURLs]);
  const selectedResult =
    crawlRecords.find((record) => record.url === selectedResultURL) ??
    crawlRecords[0] ??
    null;
  const selectedCount = selectedURLs.size;
  const estimatedDiscoverCredits = contentOptimizerCreditCost(DISCOVERY_LIMIT);
  const estimatedAnalyzeCredits = contentOptimizerCreditCost(
    Math.max(selectedCount, 1),
  );
  const quotaUsage = quotaQuery.data
    ? {
        currentMonth: quotaQuery.data.currentMonth,
        hasQuota: quotaQuery.data.hasQuota,
        isLoading: quotaQuery.isLoading || (quotaQuery.isFetching && !quotaQuery.data),
        monthlyCredits: quotaQuery.data.monthlyCredits,
        remainingCredits: quotaQuery.data.remainingCredits,
        usedCredits: quotaQuery.data.usedCredits,
      }
    : {
        currentMonth: "",
        hasQuota: false,
        isLoading: quotaQuery.isLoading,
        monthlyCredits: billingQuery.data?.monthlyQuota ?? 0,
        remainingCredits: 0,
        usedCredits: 0,
      };
  const billingPlanLabel = billingQuery.data?.plan
    ? getBillingPlanLabel(billingQuery.data.plan)
    : "";
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
  const hasEnoughCreditsFor = (credits: number) =>
    !quotaUsage.hasQuota ||
    quotaUsage.monthlyCredits <= 0 ||
    quotaUsage.remainingCredits >= credits;
  const pushInsufficientCreditsToast = (credits: number) => {
    pushWarningToast(
      t("insufficientCreditsTitle"),
      t("insufficientCreditsDescription", {
        credits,
        remaining: quotaUsage.remainingCredits,
        total: quotaUsage.monthlyCredits,
      }),
    );
  };

  function clearSelectionState() {
    setSelectedURLs(new Set());
    setSelectedResultURL("");
  }

  function applySelectedRecords(records: ContentOptimizerCrawlRecord[]) {
    const nextURLs = new Set(records.map(pageURL).filter(Boolean));
    setSelectedURLs(nextURLs);
    setSelectedResultURL(records[0]?.url ?? "");
  }

  function clearResultsState() {
    setDiscoveryResult(null);
    setCrawlResult(null);
    clearSelectionState();
  }

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
  }, [projectScopeKey]);

  useEffect(() => {
    if (hasProjectScope) {
      return;
    }

    setLoadingLatest(false);
    setHydratingProjectScope(false);
    setProjectSummaryResolved(false);
  }, [hasProjectScope]);

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
  }, [apiBaseURL, hasProjectScope, organizationId, projectId]);

  useEffect(() => {
    if (
      !hasProjectScope ||
      !projectSummaryResolved ||
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
      try {
        const latest = await getLatestContentOptimizerCrawl(apiBaseURL, {
          projectId,
          organizationId,
        });
        if (cancelled) return;

        if (latest?.result.records.length) {
          setDiscoveryLoadedKey(projectScopeKey);
          setDiscoveryResult(null);
          setCrawlResult(latest.result);
          applySelectedRecords(latest.result.records);
          setPhase("completed");
          setHydratingProjectScope(false);
          return;
        }
      } catch {
        if (cancelled) return;
      }

      const storedDiscovery = readStoredDiscovery(
        projectId,
        organizationId,
        projectWebsiteURL,
      );
      if (cancelled) return;

      setDiscoveryLoadedKey(projectScopeKey);
      if (!storedDiscovery || storedDiscovery.records.length === 0) {
        setHydratingProjectScope(false);
        return;
      }

      setDiscoveryResult(storedDiscovery);
      applySelectedRecords(storedDiscovery.records);
      if (phase === "idle") {
        setPhase("review");
      }
      setHydratingProjectScope(false);
    }

    void hydrateProjectReviewState();

    return () => {
      cancelled = true;
    };
  }, [
    apiBaseURL,
    discoveryLoadedKey,
    hasProjectScope,
    organizationId,
    phase,
    projectId,
    projectScopeKey,
    projectSummaryResolved,
    projectWebsiteURL,
  ]);

  const discoverMutation = useMutation({
    mutationFn: () =>
      startContentOptimizerCrawl(apiBaseURL, {
        projectId,
        organizationId,
        url: projectWebsiteURL,
        limit: DISCOVERY_LIMIT,
        depth: 25,
        render: false,
      }),
    onMutate: () => {
      const previousDiscovery = discoveryResult;
      const previousPhase = phase;
      setError(null);
      setPhase("discovering");
      setActiveJobId("");
      setActiveJobKind(null);
      if (!previousDiscovery || previousDiscovery.records.length === 0) {
        clearResultsState();
        writeStoredDiscovery(projectId, organizationId, projectWebsiteURL, null);
      }
      return { previousDiscovery, previousPhase };
    },
    onSuccess: (job) => {
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
      if (context?.previousDiscovery?.records.length) {
        setDiscoveryResult(context.previousDiscovery);
        setPhase(context.previousPhase === "completed" ? "completed" : "review");
      } else {
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
      const limit = options?.limit ?? Math.max(includePatterns.length, 1);

      return startContentOptimizerCrawl(apiBaseURL, {
        projectId,
        organizationId,
        url: projectWebsiteURL,
        limit,
        depth: 1,
        render: false,
        includePatterns,
      });
    },
    onMutate: (options) => {
      const limit =
        options?.limit ??
        Math.max((options?.includePatterns ?? Array.from(selectedURLs)).length, 1);

      setError(null);
      setPhase("crawling");
      setActiveJobId("");
      setActiveJobKind(null);
      setCrawlResult(null);
      setSelectedResultURL("");
      return { limit };
    },
    onSuccess: (job, _options, context) => {
      setActiveJobId(job.id);
      setActiveJobKind("crawl");
      setCrawlResult({
        id: job.id,
        status: job.status,
        total: context?.limit ?? selectedCount,
        finished: 0,
        records: [],
      });
    },
    onError: (nextError) => {
      setPhase("review");
      setError(
        nextError instanceof Error
          ? nextError.message
          : t("launchCrawlError"),
      );
    },
  });

  const analyzeSelectedRecordsMutation = useMutation({
    mutationFn: () => {
      return analyzeSelectedContentOptimizerRecords(apiBaseURL, {
        projectId,
        organizationId,
        records: selectedContentRecords,
      });
    },
    onMutate: () => {
      setError(null);
      setPhase("crawling");
      setActiveJobId("");
      setActiveJobKind(null);
      setCrawlResult(null);
      setSelectedResultURL("");
    },
    onSuccess: (result) => {
      setCrawlResult(result);
      applySelectedRecords(result.records);
      setPhase("completed");
    },
    onError: (nextError) => {
      setPhase("review");
      setError(
        nextError instanceof Error
          ? nextError.message
          : t("analyzeSelectedPagesError"),
      );
    },
  });

  useEffect(() => {
    if (!activeJobId || !activeJobKind) {
      return;
    }

    const currentResult =
      activeJobKind === "discover" ? discoveryResult : crawlResult;
    if (currentResult && isTerminalStatus(currentResult.status)) {
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const lightweight = await getContentOptimizerCrawl(apiBaseURL, {
          projectId,
          organizationId,
          jobId: activeJobId,
          limit: 1,
          analyze: activeJobKind !== "discover",
        });
        if (cancelled) return;

        if (lightweight.status === "completed") {
          const completed = await getContentOptimizerCrawl(apiBaseURL, {
            projectId,
            organizationId,
            jobId: activeJobId,
            limit: DISCOVERY_LIMIT,
            analyze: activeJobKind !== "discover",
          });
          if (cancelled) return;

          if (activeJobKind === "discover") {
            const filteredCompleted = filterDiscoveryResultToProjectDomain(
              completed,
              projectWebsiteURL,
            );
            setDiscoveryResult(filteredCompleted);
            writeStoredDiscovery(
              projectId,
              organizationId,
              projectWebsiteURL,
              filteredCompleted,
            );
            if (pendingReviewSelectedURLs?.size) {
              const discoveredURLs = new Set(
                filteredCompleted.records.map(pageURL).filter(Boolean),
              );
              const nextSelectedURLs = Array.from(pendingReviewSelectedURLs).filter(
                (url) => discoveredURLs.has(url),
              );
              if (nextSelectedURLs.length > 0) {
                setSelectedURLs(new Set(nextSelectedURLs));
                setSelectedResultURL(nextSelectedURLs[0] ?? "");
              } else {
                applySelectedRecords(filteredCompleted.records);
              }
            } else {
              applySelectedRecords(filteredCompleted.records);
            }
            setPendingReviewSelectedURLs(null);
            setPhase("review");
          } else {
            setCrawlResult(completed);
            setDiscoveryResult(null);
            applySelectedRecords(completed.records);
            setPhase("completed");
          }
          setActiveJobKind(null);
          return;
        }

        if (activeJobKind === "discover") {
          setDiscoveryResult(
            filterDiscoveryResultToProjectDomain(lightweight, projectWebsiteURL),
          );
        } else {
          setCrawlResult(lightweight);
        }
        if (isTerminalStatus(lightweight.status)) {
          setActiveJobKind(null);
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
        setPhase(activeJobKind === "discover" ? "idle" : "review");
      }
    }

    void poll();
    const interval = window.setInterval(() => void poll(), 5000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    activeJobId,
    activeJobKind,
    apiBaseURL,
    crawlResult,
    discoveryResult,
    organizationId,
    projectId,
    projectWebsiteURL,
  ]);

  function togglePage(nextURL: string, checked: boolean) {
    setSelectedURLs((current) => {
      const next = new Set(current);
      if (checked) {
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
    setSelectedURLs(new Set(discoveredPages.map(pageURL).filter(Boolean)));
  }

  function reset() {
    setPhase("idle");
    setActiveJobId("");
    setActiveJobKind(null);
    clearResultsState();
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
      if (!hasEnoughCreditsFor(estimatedDiscoverCredits)) {
        pushInsufficientCreditsToast(estimatedDiscoverCredits);
        return;
      }
      setPendingReviewSelectedURLs(lastAnalyzedURLs);
      discoverMutation.mutate();
      return;
    }

    if (discoveryResult?.records.length) {
      setPhase("review");
      return;
    }

    const storedDiscovery = readStoredDiscovery(
      projectId,
      organizationId,
      projectWebsiteURL,
    );
    const reviewResult =
      storedDiscovery && storedDiscovery.records.length > 0
        ? storedDiscovery
        : crawlResult && crawlResult.records.length > 0
          ? {
              ...crawlResult,
              records: crawlResult.records,
              total: crawlResult.records.length,
              finished: crawlResult.records.length,
            }
          : null;

    if (!reviewResult) {
      if (!hasEnoughCreditsFor(estimatedDiscoverCredits)) {
        pushInsufficientCreditsToast(estimatedDiscoverCredits);
        return;
      }
      discoverMutation.mutate();
      return;
    }

    const reviewURLs = new Set(reviewResult.records.map(pageURL).filter(Boolean));
    const selectedReviewURLs = Array.from(lastAnalyzedURLs).filter((url) =>
      reviewURLs.has(url),
    );

    setDiscoveryResult(reviewResult);
    setSelectedURLs(
      new Set(
        selectedReviewURLs.length > 0
          ? selectedReviewURLs
          : reviewResult.records.map(pageURL).filter(Boolean),
      ),
    );
    setSelectedResultURL(selectedReviewURLs[0] ?? reviewResult.records[0]?.url ?? "");
    setPhase("review");
  }

  function reanalyze(options?: CrawlRequestOptions) {
    const requestedCredits =
      options || selectedCount > 0
        ? estimatedAnalyzeCredits
        : estimatedDiscoverCredits;
    if (!hasEnoughCreditsFor(requestedCredits)) {
      pushInsufficientCreditsToast(requestedCredits);
      return;
    }
    if (options || selectedCount > 0) {
      crawlMutation.mutate(options);
      return;
    }
    discoverMutation.mutate();
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
    selectedResult,
    selectedResultURL,
    setSelectedResultURL,
    selectedURLs,
    selectedCount,
    discoverProgress,
    crawlProgress,
    estimatedAnalyzeCredits,
    estimatedDiscoverCredits,
    billingPlanLabel,
    quotaUsage,
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
      crawlMutation.isPending ||
      analyzeSelectedRecordsMutation.isPending,
    discover: () => {
      if (!hasEnoughCreditsFor(estimatedDiscoverCredits)) {
        pushInsufficientCreditsToast(estimatedDiscoverCredits);
        return;
      }
      discoverMutation.mutate();
    },
    crawlSelected: () => {
      if (!hasEnoughCreditsFor(estimatedAnalyzeCredits)) {
        pushInsufficientCreditsToast(estimatedAnalyzeCredits);
        return;
      }
      const canAnalyzeDiscoveredRecords =
        selectedContentRecords.length > 0 &&
        selectedContentRecords.every(hasExtractedContent);

      if (canAnalyzeDiscoveredRecords) {
        analyzeSelectedRecordsMutation.mutate();
        return;
      }
      crawlMutation.mutate(undefined);
    },
    reanalyze,
    reviewSelection,
    togglePage,
    toggleAllPages,
    reset,
  };
}

export type ContentOptimizerViewModel = ReturnType<
  typeof useContentOptimizerViewModel
>;
