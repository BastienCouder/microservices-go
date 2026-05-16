import type {
  GeoTrafficDailyPoint,
  GeoTrafficPage,
  GeoTrafficSource,
} from "./types";

export type TrafficReportFilters = {
  sourcePage: number;
  topPagesPage: number;
};

export type PaginatedTrafficItems<T> = {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
};

export type TrafficReportViewData = {
  availableEngines: string[];
  sources: PaginatedTrafficItems<GeoTrafficSource>;
  topPages: PaginatedTrafficItems<GeoTrafficPage>;
  timeseries: GeoTrafficDailyPoint[];
};

const defaultPageSize = 10;
const maxTrendPoints = 60;
const privatePagePathPrefixes = ["/admin"];

function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page) || page < 1) {
    return 1;
  }
  return Math.min(Math.floor(page), totalPages);
}

function paginate<T>(
  items: T[],
  page: number,
  pageSize = defaultPageSize,
): PaginatedTrafficItems<T> {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const currentPage = clampPage(page, totalPages);
  const start = (currentPage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    page: currentPage,
    pageSize,
    totalItems: items.length,
    totalPages,
  };
}

function capTimeseries(points: GeoTrafficDailyPoint[]): GeoTrafficDailyPoint[] {
  if (points.length <= maxTrendPoints) {
    return points;
  }

  const step = Math.ceil(points.length / maxTrendPoints);
  const sampled = points.filter((_, index) => index % step === 0).slice(0, maxTrendPoints - 1);
  return [...sampled, points[points.length - 1]].filter(Boolean);
}

export function isPrivateTrafficPage(page: GeoTrafficPage): boolean {
  const normalizedPath = (page.path || "/").trim().toLowerCase();
  return privatePagePathPrefixes.some(
    (prefix) => normalizedPath === prefix || normalizedPath.startsWith(`${prefix}/`),
  );
}

export function buildTrafficReportViewData({
  sources,
  topPages,
  timeseries,
  filters,
}: {
  sources: GeoTrafficSource[];
  topPages: GeoTrafficPage[];
  timeseries: GeoTrafficDailyPoint[];
  filters: TrafficReportFilters;
}): TrafficReportViewData {
  const publicTopPages = topPages.filter((page) => !isPrivateTrafficPage(page));
  const availableEngines = Array.from(
    new Set(
      [...sources.map((source) => source.engine), ...publicTopPages.map((page) => page.engine)].filter(
        (engine) => engine.trim() !== "",
      ),
    ),
  ).sort((a, b) => a.localeCompare(b));

  return {
    availableEngines,
    sources: paginate(sources, filters.sourcePage),
    topPages: paginate(publicTopPages, filters.topPagesPage),
    timeseries: capTimeseries(timeseries),
  };
}
