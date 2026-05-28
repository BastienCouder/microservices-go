import { useEffect, useMemo, useState } from "react";

import { pushErrorToast, pushInfoToast } from "@/components/ui/toast-actions";
import { useContentOptimizerViewModel } from "../../_lib/crawl/use-content-optimizer-view-model";
import { CrawlerPageHeader } from "./_components/crawler-page-header";
import { CrawlerResultsView } from "./_components/crawler-results-view";
import { DiscoveredPagesSelectionView } from "./_components/discovered-pages-selection-view";
import { InitialSetupCard } from "./_components/initial-setup-card";
import { CrawlPanelTemplate } from "./template";
import {
  computePriority,
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
  const reviewingDiscoveredPages =
    (viewModel.phase === "review" ||
      (viewModel.phase === "discovering" &&
        viewModel.discoveredPages.length > 0)) &&
    viewModel.discoveredPages.length > 0;
  const records = reviewingDiscoveredPages
    ? viewModel.discoveredPages
    : viewModel.crawlRecords;

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [severityFilter, setSeverityFilter] = useState<SeverityFilter>("all");
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("priority");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    setQuery("");
    setStatusFilter("all");
    setSeverityFilter("all");
    setIssuesOnly(false);
    setSortKey("priority");
    setSortDirection("desc");
  }, [viewModel.organizationId, viewModel.projectId]);

  const filteredDiscoveredRecords = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (normalizedQuery.length === 0) {
      return records;
    }

    return records.filter(
      (record) =>
        record.url.toLowerCase().includes(normalizedQuery) ||
        (record.title ?? "").toLowerCase().includes(normalizedQuery),
    );
  }, [query, records]);

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
      (record) => record.url === viewModel.selectedResultURL,
    ) ??
    viewModel.selectedResult ??
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
  const canUsePageSelection = records.length > 0;
  const showProjectTransition = viewModel.hydratingProjectScope;
  const showInitialSetup =
    !showProjectTransition &&
    !viewModel.error &&
    !viewModel.loadingLatest &&
    !hasAnalysis &&
    !reviewingDiscoveredPages;
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

  function handleAnalyzeSiteClick() {
    viewModel.discover();
  }

  useEffect(() => {
    if (viewModel.error) {
      pushErrorToast(new Error(viewModel.error), viewModel.error);
    }
  }, [viewModel.error]);

  useEffect(() => {
    if (viewModel.discovering) {
      pushInfoToast(
        "Découverte des pages en cours.",
        "Les pages détectées seront proposées à la sélection dès que la découverte est terminée.",
      );
    }
  }, [viewModel.discovering]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden px-3 p-2 md:p-4">
      {showProjectTransition ? <CrawlPanelTemplate /> : null}
      {showProjectTransition || showInitialSetup ? null : (
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
          onCrawlSelected={() => viewModel.crawlSelected()}
          onAnalyzeSite={handleAnalyzeSiteClick}
          onReviewSelection={() => viewModel.reviewSelection()}
        />
      )}

      <div className={showProjectTransition ? "hidden" : "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-background"}>
        {showInitialSetup ? (
          <InitialSetupCard
            projectName={viewModel.projectName}
            projectWebsiteURL={viewModel.projectWebsiteURL}
            reanalyzing={reanalyzing}
            canReanalyze={viewModel.canReanalyze}
            onAnalyzeSite={handleAnalyzeSiteClick}
          />
        ) : (
          <>
            {reviewingDiscoveredPages ? (
              <DiscoveredPagesSelectionView
                query={query}
                records={records}
                filteredRecords={filteredDiscoveredRecords}
                selectedURLs={viewModel.selectedURLs}
                selectedCount={viewModel.selectedCount}
                allSelected={viewModel.allDiscoveredSelected}
                onQueryChange={setQuery}
                onTogglePage={viewModel.togglePage}
                onToggleAll={viewModel.toggleAllPages}
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
                selectable={canUsePageSelection}
                selectedURLs={viewModel.selectedURLs}
                selectedCount={viewModel.selectedCount}
                allSelected={viewModel.allDiscoveredSelected}
                onTogglePage={viewModel.togglePage}
                onToggleAll={viewModel.toggleAllPages}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
