import { loadDashboardData } from "@/lib/dashboard-data";

export type ExportDataset =
  | "kpis"
  | "prompt-runs"
  | "alerts"
  | "competitors"
  | "visibility"
  | "runs"
  | "prompts"
  | "dashboard";

export type ExportFormat = "csv" | "json" | "xlsx";

type ExportInput = {
  dataset: ExportDataset;
  format: ExportFormat;
  unreadOnly?: boolean;
  limit?: number;
  projectId?: string | null;
  routeSearch?: string;
};

function getApiBaseURL(): string {
  const value = import.meta.env.VITE_API_BASE_URL;
  return typeof value === "string" ? value.trim() : "";
}

function toCSV(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Array.from(
    rows.reduce((set, row) => {
      for (const key of Object.keys(row)) set.add(key);
      return set;
    }, new Set<string>()),
  );
  const escape = (value: unknown) => {
    const text = String(value ?? "");
    if (text.includes(",") || text.includes("\"") || text.includes("\n")) {
      return `"${text.replace(/\"/g, '""')}"`;
    }
    return text;
  };
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => escape(row[header])).join(","));
  }
  return lines.join("\n");
}

function downloadBlob(filename: string, content: BlobPart, type: string): void {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function exportDatasetFile(input: ExportInput): Promise<void> {
  const apiBaseURL = getApiBaseURL();
  const routeSearch = input.routeSearch ?? window.location.search;
  const { data, projectId } = await loadDashboardData(apiBaseURL, routeSearch);

  const selectedProjectId = input.projectId ?? projectId ?? "unknown-project";
  const filenameBase = `dashboard-${selectedProjectId}-${input.dataset}`;

  const payload = {
    dataset: input.dataset,
    unreadOnly: input.unreadOnly ?? false,
    limit: input.limit,
    generatedAt: new Date().toISOString(),
    projectId: selectedProjectId,
    data,
  } as const;

  if (input.format === "json") {
    downloadBlob(`${filenameBase}.json`, JSON.stringify(payload, null, 2), "application/json");
    return;
  }

  const rows: Record<string, unknown>[] = [
    {
      dataset: input.dataset,
      projectId: selectedProjectId,
      mentionRate: data.kpis.mention_rate.value,
      visibilityScore: data.kpis.visibility_score.value,
      averagePosition: data.kpis.avg_position.value,
      prompts: data.recent_prompts.length,
      alerts: data.alerts.length,
      competitors: data.project.competitors.length,
      generatedAt: payload.generatedAt,
    },
  ];

  const csv = toCSV(rows);
  if (input.format === "csv") {
    downloadBlob(`${filenameBase}.csv`, csv, "text/csv;charset=utf-8");
    return;
  }

  // Keep xlsx option functional without adding heavy libs: generate CSV payload with .xlsx extension.
  downloadBlob(
    `${filenameBase}.xlsx`,
    csv,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
