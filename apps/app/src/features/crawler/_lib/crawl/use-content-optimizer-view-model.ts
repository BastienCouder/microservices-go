import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import {
  getLatestContentOptimizerCrawl,
  getContentOptimizerCrawl,
  getProjectSummary,
  startContentOptimizerCrawl,
  type ContentOptimizerCrawlRecord,
  type ContentOptimizerCrawlResult,
} from "../content-optimizer-api";
import {
  readOrganizationIdFromSearch,
  readProjectIdFromSearch,
  readSelectedOrganizationID,
  readSelectedProjectToken,
} from "@/shared/selection";

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

export function useContentOptimizerViewModel({
  apiBaseURL,
  routeSearch,
}: UseContentOptimizerViewModelInput) {
  const projectId = useMemo(
    () => readProjectIdFromSearch(routeSearch) || readSelectedProjectToken(),
    [routeSearch],
  );
  const organizationId = useMemo(
    () =>
      readOrganizationIdFromSearch(routeSearch) || readSelectedOrganizationID(),
    [routeSearch],
  );

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
  const [latestLoadedKey, setLatestLoadedKey] = useState("");
  const [loadingLatest, setLoadingLatest] = useState(false);

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
  const allDiscoveredSelected =
    discoveredPages.length > 0 &&
    discoveredPages.every((record) => selectedURLs.has(pageURL(record)));
  const canDiscover =
    apiBaseURL.trim() !== "" &&
    projectId.trim() !== "" &&
    isValidHTTPURL(projectWebsiteURL.trim()) &&
    phase !== "discovering" &&
    phase !== "crawling";
  const canCrawlSelected = phase === "review" && selectedCount > 0;
  const canReanalyze =
    canDiscover &&
    (selectedCount > 0 || crawlRecords.length > 0 || !crawlResult);

  useEffect(() => {
    const loadKey = `${organizationId}|${projectId}`;
    if (
      apiBaseURL.trim() === "" ||
      projectId.trim() === "" ||
      organizationId.trim() === "" ||
      latestLoadedKey === loadKey ||
      phase !== "idle"
    ) {
      return;
    }

    let cancelled = false;

    async function loadLatest() {
      try {
        setLoadingLatest(true);
        const projectSummaryPromise = getProjectSummary(apiBaseURL, {
          projectId,
          organizationId,
        });
        const latestPromise = getLatestContentOptimizerCrawl(apiBaseURL, {
          projectId,
          organizationId,
        });
        const latest = await latestPromise;
        if (cancelled) return;
        setLatestLoadedKey(loadKey);
        if (!latest) {
          try {
            const projectSummary = await projectSummaryPromise;
            if (cancelled) return;
            setProjectWebsiteURL(projectSummary.websiteUrl);
            setProjectName(projectSummary.name);
          } catch {
            if (cancelled) return;
          }
          return;
        }

        const result = latest.result;
        setCrawlResult(result);
        setDiscoveryResult(result);
        setSelectedURLs(new Set(result.records.map(pageURL).filter(Boolean)));
        if (result.records[0]?.url) {
          setSelectedResultURL(result.records[0].url);
        }
        setPhase("completed");

        try {
          const projectSummary = await projectSummaryPromise;
          if (cancelled) return;
          setProjectWebsiteURL(projectSummary.websiteUrl);
          setProjectName(projectSummary.name);
        } catch {
          if (cancelled) return;
        }
      } catch (nextError) {
        if (cancelled) return;
        setLatestLoadedKey(loadKey);
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Impossible de charger le dernier crawl.",
        );
      } finally {
        if (!cancelled) {
          setLoadingLatest(false);
        }
      }
    }

    void loadLatest();

    return () => {
      cancelled = true;
    };
  }, [apiBaseURL, latestLoadedKey, organizationId, phase, projectId]);

  const discoverMutation = useMutation({
    mutationFn: () =>
      startContentOptimizerCrawl(apiBaseURL, {
        projectId,
        organizationId,
        url: projectWebsiteURL,
        limit: 50,
        depth: 3,
        render: false,
      }),
    onMutate: () => {
      setError(null);
      setPhase("discovering");
      setActiveJobId("");
      setActiveJobKind(null);
      setDiscoveryResult(null);
      setCrawlResult(null);
      setSelectedURLs(new Set());
      setSelectedResultURL("");
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
    onError: (nextError) => {
      setPhase("idle");
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Impossible d'analyser le site.",
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
      const includePatterns =
        options?.includePatterns ?? Array.from(selectedURLs);
      const limit = options?.limit ?? Math.max(includePatterns.length, 1);

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
          : "Impossible de lancer le crawl.",
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
        });
        if (cancelled) return;

        if (lightweight.status === "completed") {
          const completed = await getContentOptimizerCrawl(apiBaseURL, {
            projectId,
            organizationId,
            jobId: activeJobId,
            limit: 1000,
          });
          if (cancelled) return;

          if (activeJobKind === "discover") {
            const nextURLs = new Set(
              completed.records.map(pageURL).filter(Boolean),
            );
            setDiscoveryResult(completed);
            setSelectedURLs(nextURLs);
            setPhase("review");
          } else {
            setCrawlResult(completed);
            setPhase("completed");
            if (completed.records[0]?.url) {
              setSelectedResultURL(completed.records[0].url);
            }
          }
          setActiveJobKind(null);
          return;
        }

        if (activeJobKind === "discover") {
          setDiscoveryResult(lightweight);
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
            : "Impossible de lire le crawl.",
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
    setDiscoveryResult(null);
    setCrawlResult(null);
    setSelectedURLs(new Set());
    setSelectedResultURL("");
    setError(null);
  }

  function reanalyze(options?: CrawlRequestOptions) {
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
    allDiscoveredSelected,
    canDiscover,
    canCrawlSelected,
    canReanalyze,
    error,
    loadingLatest,
    discovering: phase === "discovering" || discoverMutation.isPending,
    crawling: phase === "crawling" || crawlMutation.isPending,
    discover: () => discoverMutation.mutate(),
    crawlSelected: () => crawlMutation.mutate(undefined),
    reanalyze,
    togglePage,
    toggleAllPages,
    reset,
  };
}

export type ContentOptimizerViewModel = ReturnType<
  typeof useContentOptimizerViewModel
>;
