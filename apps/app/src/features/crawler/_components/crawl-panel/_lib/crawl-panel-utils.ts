import type { ContentOptimizerCrawlRecord } from "../../../_lib/content-optimizer-api";

export type CrawlColumn = {
  id: string;
  label: string;
  className?: string;
};

export type SeverityFilter = "all" | "high" | "medium" | "low" | "none";
export type StatusFilter =
  | "all"
  | "completed"
  | "running"
  | "errored"
  | "cancelled";
export type SortKey = "page" | "http" | "status" | "priority" | "findings";

export const DEFAULT_REANALYZE_LIMIT = 100;

export const columns: CrawlColumn[] = [
  { id: "page", label: "Page", className: "min-w-[260px]" },
  { id: "url", label: "URL", className: "min-w-[260px]" },
  { id: "http", label: "HTTP", className: "w-[88px]" },
  { id: "status", label: "Statut", className: "w-[120px]" },
  { id: "priority", label: "Priorité", className: "w-[120px]" },
  { id: "findings", label: "Constats", className: "min-w-[240px]" },
  { id: "action", label: "Action recommandée", className: "min-w-[260px]" },
];

export function statusTone(
  status: string,
): "default" | "outline" | "destructive" | "secondary" {
  if (status === "completed") return "default";
  if (status === "running") return "secondary";
  if (status.includes("cancelled") || status === "errored") {
    return "destructive";
  }
  return "outline";
}

export function statusLabel(status: string): string {
  if (status === "completed") return "Terminé";
  if (status === "running") return "En cours";
  if (status === "errored") return "En erreur";
  if (status.includes("cancelled")) return "Annulé";
  return status;
}

export function pageContent(record: ContentOptimizerCrawlRecord): string {
  if (record.markdown?.trim()) return record.markdown.trim();
  if (record.html?.trim()) return record.html.trim();
  if (record.json != null) return JSON.stringify(record.json, null, 2);
  return "Aucun contenu extrait pour cette page.";
}

export function severityTone(severity: string): string {
  if (severity === "high") {
    return "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200";
  }
  if (severity === "medium") {
    return "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200";
  }
  if (severity === "low") {
    return "border-transparent bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200";
  }
  return "";
}

export function severityLabel(severity: string): string {
  if (severity === "high") return "Haute";
  if (severity === "medium") return "Moyenne";
  if (severity === "low") return "Faible";
  return "-";
}

function severityRank(severity: string): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  if (severity === "low") return 1;
  return 0;
}

export function primaryIssue(record: ContentOptimizerCrawlRecord) {
  return (
    [...(record.issues ?? [])].sort(
      (left, right) =>
        severityRank(right.severity) - severityRank(left.severity),
    )[0] ?? null
  );
}

export function hostnameFromURL(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

export function pathnameFromURL(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}${parsed.hash}` || "/";
  } catch {
    return url;
  }
}

export function computePriority(record: ContentOptimizerCrawlRecord): {
  label: "Critique" | "Haute" | "Moyenne" | "Basse";
  rank: number;
  className: string;
} {
  const issues = record.issues ?? [];
  const highCount = issues.filter((issue) => issue.severity === "high").length;
  const mediumCount = issues.filter(
    (issue) => issue.severity === "medium",
  ).length;
  const httpStatus = record.httpStatus ?? 200;

  if (httpStatus >= 500 || highCount >= 2) {
    return {
      label: "Critique",
      rank: 4,
      className:
        "border-transparent bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
    };
  }

  if (highCount >= 1 || httpStatus >= 400) {
    return {
      label: "Haute",
      rank: 3,
      className:
        "border-transparent bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
    };
  }

  if (mediumCount >= 1) {
    return {
      label: "Moyenne",
      rank: 2,
      className:
        "border-transparent bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    };
  }

  return {
    label: "Basse",
    rank: 1,
    className:
      "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  };
}
