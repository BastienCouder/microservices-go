import { apiRoutes } from "@/lib/api-config";
import { apiFetchRuntime } from "@/lib/runtime-api";
import { type RuntimeMode } from "@/lib/runtime-mode";

export type ExportFormat = "csv" | "json" | "xlsx";

export type ExportDataset =
  | "dashboard"
  | "kpis"
  | "visibility"
  | "prompt-runs"
  | "runs"
  | "alerts"
  | "prompts"
  | "competitors";

interface ExportDatasetParams {
  projectId?: string;
  dataset: ExportDataset;
  format: ExportFormat;
  unreadOnly?: boolean;
  limit?: number;
  demo?: boolean;
  mode?: RuntimeMode;
}

export async function exportDatasetFile(params: ExportDatasetParams): Promise<void> {
  const response = await apiFetchRuntime({
    projectPath: (projectId) => apiRoutes.exports.dataset(projectId, params.dataset),
    demoPath: apiRoutes.exports.demoDataset(params.dataset),
    projectId: params.projectId,
    mode: params.mode,
    demo: params.demo,
    query: {
      format: params.format,
      unreadOnly: typeof params.unreadOnly === "boolean" ? params.unreadOnly : undefined,
      limit: typeof params.limit === "number" ? params.limit : undefined,
    },
    init: {
      method: "GET",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Export failed (${response.status}): ${errorText}`);
  }

  const blob = await response.blob();
  const fileName = getFileNameFromResponse(response, params);

  const objectUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.setAttribute("download", fileName);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(objectUrl);
}

function getFileNameFromResponse(response: Response, params: ExportDatasetParams): string {
  const contentDisposition = response.headers.get("content-disposition");
  const match = contentDisposition?.match(/filename="?([^";]+)"?/i);

  if (match?.[1]) {
    return match[1];
  }

  return `${params.dataset}.${params.format}`;
}
