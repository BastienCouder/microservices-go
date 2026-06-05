import type {
  ContentOptimizerCrawlRecord,
  ContentOptimizerIssue,
} from "../../../_lib/content-optimizer-api";

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

export const columns: CrawlColumn[] = [
  { id: "page", label: "Page", className: "min-w-[260px]" },
  { id: "url", label: "URL", className: "min-w-[260px]" },
  { id: "http", label: "HTTP", className: "w-[88px]" },
  { id: "status", label: "Statut", className: "w-[120px]" },
  { id: "priority", label: "Priorité", className: "w-[120px]" },
  { id: "findings", label: "Signaux", className: "w-[120px]" },
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

export function formatSignalCount(count: number): string {
  return `${count} ${count > 1 ? "signaux" : "signal"}`;
}

export function pageContent(record: ContentOptimizerCrawlRecord): string {
  if (record.markdown?.trim()) return record.markdown.trim();
  if (record.html?.trim()) return record.html.trim();
  if (record.json != null) return JSON.stringify(record.json, null, 2);
  return "Aucun contenu extrait pour cette page.";
}

const htmlEntityMap: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: '"',
};

export function decodeHTMLText(value: string | null | undefined): string {
  if (!value) return "";

  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith("#x")) {
      const codePoint = Number.parseInt(normalized.slice(2), 16);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    if (normalized.startsWith("#")) {
      const codePoint = Number.parseInt(normalized.slice(1), 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }
    return htmlEntityMap[normalized] ?? match;
  });
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

export type GeoInsightGroup = {
  id: string;
  label: string;
  description: string;
  fixTypes: string[];
};

export const geoInsightGroups: GeoInsightGroup[] = [
  {
    id: "qualitative",
    label: "Lecture IA",
    description: "Intentions, citabilité et nuances éditoriales.",
    fixTypes: [],
  },
  {
    id: "understanding",
    label: "Compréhension IA",
    description: "Entité, offre, audience et cas d'usage.",
    fixTypes: [
      "add_entity_context",
      "clarify_offer",
      "add_audience_use_cases",
    ],
  },
  {
    id: "answer",
    label: "Réponse générative",
    description: "Réponse courte et questions directement réutilisables.",
    fixTypes: ["add_direct_answer", "add_faq"],
  },
  {
    id: "credibility",
    label: "Crédibilité",
    description: "Preuves, sources, chiffres et fraîcheur.",
    fixTypes: ["add_evidence", "add_freshness_signal"],
  },
  {
    id: "structure",
    label: "Structure contenu",
    description: "Titres, profondeur, schema et lisibilité.",
    fixTypes: [
      "add_title",
      "improve_title",
      "add_meta_description",
      "expand_content",
      "add_topic_depth",
      "improve_h1",
      "improve_headings",
      "add_schema_markup",
    ],
  },
  {
    id: "conversion",
    label: "Maillage & choix",
    description: "Liens internes, comparaison et parcours suivant.",
    fixTypes: [
      "add_internal_links",
      "add_comparison_context",
      "create_blog",
    ],
  },
];

export function issuesForGeoInsightGroup(
  issues: ContentOptimizerIssue[] | undefined,
  group: GeoInsightGroup,
): ContentOptimizerIssue[] {
  const fixTypes = new Set(group.fixTypes);
  if (group.id === "qualitative") {
    return (issues ?? []).filter(
      (issue) => issue.source === "ai" || issue.fixType.startsWith("ai_"),
    );
  }
  return (issues ?? []).filter((issue) => fixTypes.has(issue.fixType));
}

export function issueSourceLabel(issue: ContentOptimizerIssue): string {
  if (issue.source === "ai" || issue.fixType.startsWith("ai_")) {
    return "IA";
  }
  return "Règle";
}

export type GeoKpiSummary = {
  id: string;
  label: string;
  value: string;
  caption: string;
  tone: "default" | "success" | "warning";
};

function severityPenalty(severity: string): number {
  if (severity === "high") return 22;
  if (severity === "medium") return 12;
  if (severity === "low") return 6;
  return 0;
}

export function computeGeoReadinessScore(
  record: ContentOptimizerCrawlRecord,
): number {
  const httpStatus = record.httpStatus ?? 200;

  if (httpStatus >= 500) return 0;

  const httpPenalty = httpStatus >= 400 ? 35 : 0;
  const issuePenalty = (record.issues ?? []).reduce(
    (total, issue) => total + severityPenalty(issue.severity),
    0,
  );

  return Math.max(0, 100 - httpPenalty - issuePenalty);
}

function formatRatio(value: number, total: number): string {
  if (total === 0) return "0/0";
  return `${value}/${total}`;
}

function formatPercent(value: number, total: number): string {
  if (total === 0) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function groupReadyCount(
  records: ContentOptimizerCrawlRecord[],
  groupId: string,
): number {
  const group = geoInsightGroups.find((candidate) => candidate.id === groupId);
  if (!group) return 0;

  return records.filter(
    (record) => issuesForGeoInsightGroup(record.issues, group).length === 0,
  ).length;
}

export function computeGeoKpiSummaries(
  records: ContentOptimizerCrawlRecord[],
): GeoKpiSummary[] {
  const analyzedRecords = records.filter(
    (record) => record.status === "completed",
  );
  const analyzedCount = analyzedRecords.length;
  const averageScore =
    analyzedCount === 0
      ? 0
      : Math.round(
          analyzedRecords.reduce(
            (total, record) => total + computeGeoReadinessScore(record),
            0,
          ) / analyzedCount,
        );
  const riskyCount = analyzedRecords.filter(
    (record) => computePriority(record).rank >= 3,
  ).length;
  const understandingReady = groupReadyCount(analyzedRecords, "understanding");
  const answerReady = groupReadyCount(analyzedRecords, "answer");
  const credibilityReady = groupReadyCount(analyzedRecords, "credibility");

  return [
    {
      id: "geo-score",
      label: "Score GEO moyen",
      value: `${averageScore}%`,
      caption:
        analyzedCount === 0
          ? "Aucune page analysée"
          : `${analyzedCount} page(s) analysée(s)`,
      tone:
        averageScore >= 80
          ? "success"
          : averageScore >= 55
            ? "default"
            : "warning",
    },
    {
      id: "risk-pages",
      label: "Pages à risque",
      value: String(riskyCount),
      caption: "Priorité haute ou critique",
      tone: riskyCount === 0 ? "success" : "warning",
    },
    {
      id: "understanding-ready",
      label: "Compréhension OK",
      value: formatRatio(understandingReady, analyzedCount),
      caption: `${formatPercent(
        understandingReady,
        analyzedCount,
      )} sans flou entité/offre`,
      tone:
        understandingReady === analyzedCount && analyzedCount > 0
          ? "success"
          : "default",
    },
    {
      id: "answer-ready",
      label: "Réponses prêtes",
      value: formatRatio(answerReady, analyzedCount),
      caption: `${formatPercent(answerReady, analyzedCount)} avec réponse/FAQ`,
      tone:
        answerReady === analyzedCount && analyzedCount > 0
          ? "success"
          : "default",
    },
    {
      id: "credibility-ready",
      label: "Crédibilité OK",
      value: formatRatio(credibilityReady, analyzedCount),
      caption: `${formatPercent(
        credibilityReady,
        analyzedCount,
      )} avec preuves fraîches`,
      tone:
        credibilityReady === analyzedCount && analyzedCount > 0
          ? "success"
          : "default",
    },
  ];
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
