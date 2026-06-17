import type {
  OptimizationError,
} from "@/features/perception/_lib/shared/optimization-errors-data";
import {
  toProjectModelVisual,
  type ProjectModelMeta,
} from "@/lib/project-models";
import {
  SEVERITY_COLUMNS,
  STATUS_COLUMNS,
  type ActionStatusFilter,
  type ErrorHubStatusColumnId,
  type PeriodFilter,
  type SourceFilter,
} from "./error-hub-types";
import i18n from "@/shared/i18n";
import { translateI18nText } from "@/shared/hooks/use-i18n";

export function readSourceFilterFromSearch(routeSearch: string): SourceFilter {
  const normalized = routeSearch.startsWith("?")
    ? routeSearch.slice(1)
    : routeSearch;

  const source = new URLSearchParams(normalized).get("source");

  return source === "monitoring" ||
    source === "perception" ||
    source === "crawler"
    ? source
    : "all";
}

function getActionStatusRank(status: string | undefined) {
  if (status === "processing") return 0;
  if (status === "done") return 2;
  return 1;
}

function getSeverityRank(severity: OptimizationError["severity"]) {
  if (severity === "high") return 0;
  if (severity === "medium") return 1;
  return 2;
}

function sortErrorsByActionStatus(
  errors: OptimizationError[],
  actionStatusesByErrorId: ReadonlyMap<string, string>,
) {
  return [...errors].sort((left, right) => {
    const rankDiff =
      getActionStatusRank(actionStatusesByErrorId.get(left.id)) -
      getActionStatusRank(actionStatusesByErrorId.get(right.id));

    if (rankDiff !== 0) return rankDiff;

    if (left.source !== right.source) {
      return left.source.localeCompare(right.source);
    }

    const leftResource = (left.resource ?? "").trim().toLowerCase();
    const rightResource = (right.resource ?? "").trim().toLowerCase();

    if (leftResource !== rightResource) {
      return leftResource.localeCompare(rightResource);
    }

    return left.title.localeCompare(right.title);
  });
}

function sortErrorsBySeverity(
  errors: OptimizationError[],
  actionStatusesByErrorId: ReadonlyMap<string, string>,
) {
  return [...errors].sort((left, right) => {
    const severityDiff =
      getSeverityRank(left.severity) - getSeverityRank(right.severity);

    if (severityDiff !== 0) return severityDiff;

    const rankDiff =
      getActionStatusRank(actionStatusesByErrorId.get(left.id)) -
      getActionStatusRank(actionStatusesByErrorId.get(right.id));

    if (rankDiff !== 0) return rankDiff;

    if (left.source !== right.source) {
      return left.source.localeCompare(right.source);
    }

    const leftResource = (left.resource ?? "").trim().toLowerCase();
    const rightResource = (right.resource ?? "").trim().toLowerCase();

    if (leftResource !== rightResource) {
      return leftResource.localeCompare(rightResource);
    }

    return left.title.localeCompare(right.title);
  });
}

export function groupErrorsBySeverity(
  errors: OptimizationError[],
  actionStatusesByErrorId: ReadonlyMap<string, string>,
) {
  return SEVERITY_COLUMNS.map((column) => ({
    ...column,
    errors: sortErrorsByActionStatus(
      errors.filter((error) => error.severity === column.severity),
      actionStatusesByErrorId,
    ),
  }));
}

function matchesStatusColumn(
  status: string | undefined,
  columnId: ErrorHubStatusColumnId,
) {
  if (columnId === "todo") {
    return status !== "processing" && status !== "done";
  }

  return status === columnId;
}

export function groupErrorsByActionStatus(
  errors: OptimizationError[],
  actionStatusesByErrorId: ReadonlyMap<string, string>,
) {
  return STATUS_COLUMNS.map((column) => ({
    ...column,
    errors: sortErrorsBySeverity(
      errors.filter((error) =>
        matchesStatusColumn(actionStatusesByErrorId.get(error.id), column.id),
      ),
      actionStatusesByErrorId,
    ),
  }));
}

export function listAvailableModels(errors: OptimizationError[]) {
  return Array.from(
    new Set(errors.flatMap((error) => error.detectedInModels).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

function getErrorSearchText(error: OptimizationError) {
  return [
    error.title,
    error.issue,
    error.impact,
    error.generatedContent,
    error.type,
    error.source,
    error.origin ?? "",
    error.resource ?? "",
    ...error.detectedInModels,
  ]
    .join(" ")
    .toLowerCase();
}

function parseErrorDate(value: string | undefined): Date | null {
  if (!value) return null;

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function filterErrorsByPeriod(
  errors: OptimizationError[],
  period: PeriodFilter,
) {
  if (period === "all") return errors;

  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const minTime = Date.now() - days * 24 * 60 * 60 * 1000;

  return errors.filter((error) => {
    const createdAt = parseErrorDate(error.createdAt);
    return !createdAt || createdAt.getTime() >= minTime;
  });
}

export function filterErrorsByModels(
  errors: OptimizationError[],
  selectedModels: string[],
) {
  if (selectedModels.length === 0) return errors;

  return errors.filter((error) =>
    error.detectedInModels.some((model) => selectedModels.includes(model)),
  );
}

export function filterErrorsByCompetitors(
  errors: OptimizationError[],
  selectedCompetitors: string[],
) {
  if (selectedCompetitors.length === 0) return errors;

  const normalizedCompetitors = selectedCompetitors.map((competitor) =>
    competitor.trim().toLowerCase(),
  );

  return errors.filter((error) => {
    const haystack = getErrorSearchText(error);

    return normalizedCompetitors.some((competitor) =>
      haystack.includes(competitor),
    );
  });
}

export function filterErrorsBySearch(
  errors: OptimizationError[],
  search: string,
) {
  const needle = search.trim().toLowerCase();

  if (!needle) return errors;

  return errors.filter((error) => getErrorSearchText(error).includes(needle));
}

export function filterErrorsByActionStatus(
  errors: OptimizationError[],
  actionStatusesByErrorId: ReadonlyMap<string, string>,
  actionStatusFilter: ActionStatusFilter,
) {
  if (actionStatusFilter === "all") return errors;

  return errors.filter(
    (error) => actionStatusesByErrorId.get(error.id) === actionStatusFilter,
  );
}

export function filterErrorsBySource(
  errors: OptimizationError[],
  sourceFilter: SourceFilter,
) {
  if (sourceFilter === "all") return errors;

  return errors.filter((error) => error.source === sourceFilter);
}

export function canCreateActionFromError(error: OptimizationError) {
  if (error.source !== "crawler") return true;

  const hasSpecificSuggestion = Boolean(error.generatedContentKey?.trim());
  const isGenericCrawlerError = error.type === "crawler_issue";

  return hasSpecificSuggestion && !isGenericCrawlerError;
}

export function getFilteredErrors({
  actionStatusFilter,
  actionStatusesByErrorId,
  errors,
  period,
  search,
  selectedCompetitors,
  selectedModels,
  sourceFilter,
}: {
  actionStatusFilter: ActionStatusFilter;
  actionStatusesByErrorId: ReadonlyMap<string, string>;
  errors: OptimizationError[];
  period: PeriodFilter;
  search: string;
  selectedCompetitors: string[];
  selectedModels: string[];
  sourceFilter: SourceFilter;
}) {
  return filterErrorsBySearch(
    filterErrorsBySource(
      filterErrorsByActionStatus(
        filterErrorsByCompetitors(
          filterErrorsByModels(filterErrorsByPeriod(errors, period), selectedModels),
          selectedCompetitors,
        ),
        actionStatusesByErrorId,
        actionStatusFilter,
      ),
      sourceFilter,
    ),
    search,
  );
}

export function getModelVisual(
  model: string,
  projectModelLookup: ReadonlyMap<string, ProjectModelMeta>,
) {
  const match = projectModelLookup.get(model.trim().toLowerCase());

  if (match) {
    return toProjectModelVisual(match);
  }

  return {
    icon: "",
    description: translateI18nText("shared-ui", "aiModel", i18n.language),
    label: model,
    provider: translateI18nText("shared-ui", "aiProvider", i18n.language),
    name: model,
  };
}

export function getMonitoringOriginBadge(
  error: OptimizationError,
  locale: string,
): { label: string; className: string } | undefined {
  if (error.source !== "monitoring") return undefined;

  if (error.origin === "alert") {
    return {
      label: translateI18nText("error-hub", "monitoringAlert", locale),
      className:
        "border-amber-200 bg-amber-500/10 text-amber-700 dark:border-amber-400/30 dark:text-amber-300",
    };
  }

  if (error.origin === "derived") {
    return {
      label: translateI18nText("error-hub", "monitoringDiagnostic", locale),
      className:
        "border-sky-200 bg-sky-500/10 text-sky-700 dark:border-sky-400/30 dark:text-sky-300",
    };
  }

  return undefined;
}

function getMonitoringOriginMeta(
  error: OptimizationError,
  locale: string,
): { label: string; value: string } | undefined {
  if (error.source !== "monitoring") return undefined;

  if (error.origin === "alert") {
    return {
      label: translateI18nText("error-hub", "contextKind", locale),
      value: translateI18nText("error-hub", "monitoringAlert", locale),
    };
  }

  if (error.origin === "derived") {
    return {
      label: translateI18nText("error-hub", "contextKind", locale),
      value: translateI18nText("error-hub", "monitoringDiagnostic", locale),
    };
  }

  return undefined;
}

export function formatErrorResource(
  resource: string | undefined,
): string | undefined {
  const value = resource?.trim();

  if (!value) return undefined;

  try {
    const url = new URL(value);
    const path =
      url.pathname === "/" ? url.hostname : `${url.hostname}${url.pathname}`;

    return path.replace(/\/$/, "") || url.hostname;
  } catch {
    return value;
  }
}

export function getCrawlerGroupLabel(
  error: OptimizationError,
  locale: string,
): string | undefined {
  if (error.source !== "crawler") return undefined;
  const resourceLabel = formatErrorResource(error.resource);
  if (!resourceLabel) return undefined;
  return `${translateI18nText("error-hub", "crawlerPage", locale)} • ${resourceLabel}`;
}

export function getErrorContextMeta(
  error: OptimizationError,
  locale: string,
): { label: string; value: string } | undefined {
  if (error.source === "crawler") {
    const resourceLabel = formatErrorResource(error.resource);

    if (resourceLabel) {
      return {
        label: translateI18nText("error-hub", "crawlerPage", locale),
        value: resourceLabel,
      };
    }
  }

  return getMonitoringOriginMeta(error, locale);
}
