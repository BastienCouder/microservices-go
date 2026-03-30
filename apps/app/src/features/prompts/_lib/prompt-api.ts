import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import { normalizePromptPage, normalizeProjectPromptRecord, PROMPTS_CATALOG_PAGE_SIZE } from "./prompt-normalizers";
import type { PromptItem, PromptPageResult, PromptSchedule, ProjectPromptRecord } from "./types";

export async function loadPromptPage(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  page: number,
  pageSize: number,
  search: string,
  signal?: AbortSignal,
): Promise<PromptPageResult> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.prompts(projectId, { page, pageSize, search }),
    {
      method: "GET",
      organizationId,
      signal,
    },
  );

  if (!response.ok) {
    throw new Error("Impossible de charger les prompts.");
  }

  return normalizePromptPage(response.data);
}

export async function loadAllPromptPages(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  search: string,
  signal?: AbortSignal,
): Promise<ProjectPromptRecord[]> {
  const firstPage = await loadPromptPage(
    apiBaseURL,
    organizationId,
    projectId,
    1,
    PROMPTS_CATALOG_PAGE_SIZE,
    search,
    signal,
  );

  if (firstPage.totalPages <= 1) {
    return firstPage.items;
  }

  const remainingPages = await Promise.all(
    Array.from({ length: firstPage.totalPages - 1 }, (_, index) =>
      loadPromptPage(
        apiBaseURL,
        organizationId,
        projectId,
        index + 2,
        PROMPTS_CATALOG_PAGE_SIZE,
        search,
        signal,
      ),
    ),
  );

  return [firstPage, ...remainingPages].flatMap((page) => page.items);
}

export async function patchPromptModels(
  apiBaseURL: string,
  organizationId: string,
  promptId: string,
  modelIds: string[],
): Promise<void> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.prompts.update(promptId), {
    method: "PATCH",
    organizationId,
    body: JSON.stringify({ modelIds }),
  });

  if (!response.ok) {
    throw new Error("Impossible de mettre a jour la couverture IA du prompt.");
  }
}

export async function patchPromptSchedule(
  apiBaseURL: string,
  organizationId: string,
  promptId: string,
  schedule: PromptSchedule,
): Promise<void> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.prompts.update(promptId), {
    method: "PATCH",
    organizationId,
    body: JSON.stringify({ schedule }),
  });

  if (!response.ok) {
    throw new Error("Impossible de mettre a jour la cadence d'analyse du prompt.");
  }
}

function unwrapSuccessEnvelope(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  if ((value as { success?: unknown }).success === true && "data" in value) {
    return (value as { data: unknown }).data;
  }
  return value;
}

export async function createProjectPrompt(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  text: string,
): Promise<ProjectPromptRecord> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.prompts(projectId), {
    method: "POST",
    organizationId,
    body: JSON.stringify({ prompts: [text] }),
  });

  if (!response.ok) {
    throw new Error("Impossible de creer le prompt.");
  }

  const payload = unwrapSuccessEnvelope(response.data);
  const rawItems = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as { prompts?: unknown[] }).prompts)
      ? (payload as { prompts: unknown[] }).prompts
      : typeof payload === "object" && payload !== null && Array.isArray((payload as { items?: unknown[] }).items)
        ? (payload as { items: unknown[] }).items
        : [];
  const firstItem = rawItems.find(
    (entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null,
  );

  if (!firstItem) {
    throw new Error("Le backend n'a pas retourne le prompt cree.");
  }

  return normalizeProjectPromptRecord(firstItem);
}

export async function patchPrompt(
  apiBaseURL: string,
  organizationId: string,
  promptId: string,
  input: {
    text?: string;
    modelIds?: string[];
    schedule?: PromptSchedule;
    status?: PromptItem["status"];
  },
): Promise<void> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.prompts.update(promptId), {
    method: "PATCH",
    organizationId,
    body: JSON.stringify(input),
  });

  if (!response.ok) {
    throw new Error("Impossible d'enregistrer le prompt.");
  }
}

export async function deleteProjectPrompt(
  apiBaseURL: string,
  organizationId: string,
  promptId: string,
): Promise<void> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.prompts.update(promptId), {
    method: "DELETE",
    organizationId,
  });

  if (!response.ok) {
    throw new Error("Impossible de supprimer le prompt.");
  }
}
