import { useEffect, useMemo, useState } from "react";

import { pushErrorToast, pushInfoToast } from "@/components/ui/toast-actions";
import { useContentOptimizerViewModel } from "../../_lib/crawl/use-content-optimizer-view-model";
import { CrawlerPageHeader } from "./_components/crawler-page-header";
import { CrawlerResultsView } from "./_components/crawler-results-view";
import { InitialSetupCard } from "./_components/initial-setup-card";
import { ReanalyzeDialog } from "./_components/reanalyze-dialog";
import {
  computePriority,
  DEFAULT_REANALYZE_LIMIT,
  primaryIssue,
  statusLabel,
  type SeverityFilter,
  type SortKey,
  type StatusFilter,
} from "./_lib/crawl-panel-utils";

type CrawlPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function CrawlPanel({ apiBaseURL, routeSearch }: CrawlPanelProps) {
  const viewModel = useContentOptimizerViewModel({ apiBaseURL, routeSearch });
  const records = viewModel.crawlRecords;

  const [query, setQuery] = useState("");
  const [reanalyzeDialogOpen, setReanalyzeDialogOpen] = useState(false);
  const [reanalyzeURLs, setReanalyzeURLs] = useState<Set<string>>(
    () => new Set(),
  );
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  const filteredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    const nextRecords = records.filter((record) => {
      const issue = primaryIssue(record);
      const matchesQuery =
        normalizedQuery.length === 0 ||
        record.url.toLowerCase().includes(normalizedQuery) ||
        (record.title ?? "").toLowerCase().includes(normalizedQuery);

      const matchesStatus =
        statusFilter === "all" || record.status === statusFilter;
      const matchesSeverity =
        severityFilter === "all" ||
        (severityFilter === "none"
          ? !issue
          : issue?.severity === severityFilter);
      const matchesIssuesOnly = !issuesOnly || (record.issues?.length ?? 0) > 0;

      return (
        matchesQuery && matchesStatus && matchesSeverity && matchesIssuesOnly
      );
    });

    return [...nextRecords].sort((left, right) => {
      let comparison = 0;

      if (sortKey === "findings") {
        comparison = (left.issues?.length ?? 0) - (right.issues?.length ?? 0);
      } else if (sortKey === "http") {
        comparison = (left.httpStatus ?? 0) - (right.httpStatus ?? 0);
      } else if (sortKey === "status") {
        comparison = statusLabel(left.status).localeCompare(
          statusLabel(right.status),
        );
      } else if (sortKey === "page") {
        comparison = (left.title ?? left.url).localeCompare(
          right.title ?? right.url,
        );
      } else {
        comparison = computePriority(left).rank - computePriority(right).rank;
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [
    issuesOnly,
    query,
    records,
    severityFilter,
    sortDirection,
    sortKey,
    statusFilter,
  ]);

  const selectedRecord =
    filteredRecords.find(
      (record) => record.url === viewModel.selectedResult?.url,
    ) ??
    filteredRecords[0] ??
    null;

  const recordsWithIssues = filteredRecords.filter(
    (record) => (record.issues?.length ?? 0) > 0,
  ).length;
  const criticalCount = filteredRecords.filter(
    (record) => computePriority(record).label === "Critique",
  ).length;
  const reanalyzing = viewModel.discovering || viewModel.crawling;
  const hasAnalysis = viewModel.crawlRecords.length > 0;
  const reviewingDiscoveredPages =
    viewModel.phase === "review" && viewModel.discoveredPages.length > 0;
  const showInitialSetup =
    !viewModel.error && !viewModel.loadingLatest && !hasAnalysis && !reviewingDiscoveredPages;
  const reanalyzePages = useMemo(
    () =>
      (records.length > 0 ? records : viewModel.discoveredPages).filter(
        (record) => record.url.trim() !== "",
      ),
    [records, viewModel.discoveredPages],
  );
  const allReanalyzePagesSelected =
    reanalyzePages.length > 0 &&
    reanalyzePages.every((record) => reanalyzeURLs.has(record.url.trim()));

  function toggleSort(nextKey: SortKey) {
    if (sortKey === nextKey) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(nextKey);
    setSortDirection(
      nextKey === "page" || nextKey === "status" ? "asc" : "desc",
    );
  }

  function handleReanalyzeDialogOpenChange(open: boolean) {
    setReanalyzeDialogOpen(open);
    if (!open) return;

    const selected =
      viewModel.selectedURLs.size > 0
        ? viewModel.selectedURLs
        : new Set(
            reanalyzePages.map((record) => record.url.trim()).filter(Boolean),
          );
    setReanalyzeURLs(new Set(selected));
  }

  function toggleReanalyzePage(nextURL: string, checked: boolean) {
    setReanalyzeURLs((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(nextURL);
      } else {
        next.delete(nextURL);
      }
      return next;
    });
  }

  function toggleAllReanalyzePages(checked: boolean) {
    if (!checked) {
      setReanalyzeURLs(new Set());
      return;
    }
    setReanalyzeURLs(
      new Set(
        reanalyzePages.map((record) => record.url.trim()).filter(Boolean),
      ),
    );
  }

  function submitReanalysis() {
    const includePatterns = Array.from(reanalyzeURLs);

    viewModel.reanalyze({
      limit: DEFAULT_REANALYZE_LIMIT,
      includePatterns,
    });
    setReanalyzeDialogOpen(false);
  }

  function handleAnalyzeSiteClick() {
    viewModel.reanalyze({
      limit: DEFAULT_REANALYZE_LIMIT,
      includePatterns: [],
    });
  }

  function handleScopedAnalysisClick() {
    handleReanalyzeDialogOpenChange(true);
  }

  useEffect(() => {
    if (viewModel.error) {
      pushErrorToast(new Error(viewModel.error), viewModel.error);
    }
  }, [viewModel.error]);

  useEffect(() => {
    if (viewModel.discovering) {
      pushInfoToast(
        "Mise à jour de la liste des pages en cours.",
        "Les nouvelles pages du site seront ajoutées dès que la découverte est terminée.",
      );
    }
  }, [viewModel.discovering]);

  useEffect(() => {
    if (reviewingDiscoveredPages) {
      pushInfoToast(
        `${viewModel.discoveredPages.length} page(s) détectée(s)`,
        "La liste des pages a été mise à jour. Utilise les actions du header pour analyser toutes les pages ou choisir seulement celles à relancer.",
      );
    }
  }, [reviewingDiscoveredPages, viewModel.discoveredPages.length]);
  
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      {showInitialSetup ? null : (
        <CrawlerPageHeader
          reviewingDiscoveredPages={reviewingDiscoveredPages}
          hasAnalysis={hasAnalysis}
          reanalyzing={reanalyzing}
          discovering={viewModel.discovering}
          canDiscover={viewModel.canDiscover}
          canCrawlSelected={viewModel.canCrawlSelected}
          canReanalyze={viewModel.canReanalyze}
          loadingLatest={viewModel.loadingLatest}
          onDiscover={() => viewModel.discover()}
          onOpenScopedAnalysis={handleScopedAnalysisClick}
          onCrawlSelected={() => viewModel.crawlSelected()}
          onAnalyzeSite={handleAnalyzeSiteClick}
        />
      )}

      <ReanalyzeDialog
        open={reanalyzeDialogOpen}
        reviewingDiscoveredPages={reviewingDiscoveredPages}
        reanalyzing={reanalyzing}
        reanalyzePages={reanalyzePages}
        reanalyzeURLs={reanalyzeURLs}
        allReanalyzePagesSelected={allReanalyzePagesSelected}
        onOpenChange={handleReanalyzeDialogOpenChange}
        onToggleAll={toggleAllReanalyzePages}
        onTogglePage={toggleReanalyzePage}
        onSubmit={submitReanalysis}
      />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-background">
        {showInitialSetup ? (
          <InitialSetupCard
            projectName={viewModel.projectName}
            projectWebsiteURL={viewModel.projectWebsiteURL}
            reanalyzing={reanalyzing}
            canReanalyze={viewModel.canReanalyze}
            onAnalyzeSite={handleAnalyzeSiteClick}
          />
        ) : (
          <CrawlerResultsView
            errorLabel={viewModel.error}
            loadingLatest={viewModel.loadingLatest}
            query={query}
            statusFilter={statusFilter}
            severityFilter={severityFilter}
            sortKey={sortKey}
            sortDirection={sortDirection}
            records={records}
            filteredRecords={filteredRecords}
            selectedRecord={selectedRecord}
            onQueryChange={setQuery}
            onStatusFilterChange={setStatusFilter}
            onSeverityFilterChange={setSeverityFilter}
            onToggleSort={toggleSort}
            onSelectRecord={viewModel.setSelectedResultURL}
          />
        )}
      </div>
    </div>
  );
}
