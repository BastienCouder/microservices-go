import { apiRoutes } from "@/lib/api-config";
import {
  gatewayJSON,
  requireGatewayResult,
  unwrapGatewayPayload,
} from "@/shared/api/gateway";
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

  return normalizePromptPage(
    requireGatewayResult(response, "Impossible de charger les prompts."),
  );
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

  requireGatewayResult(response, "Impossible de mettre a jour la couverture IA du prompt.");
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

  requireGatewayResult(response, "Impossible de mettre a jour la cadence d'analyse du prompt.");
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

  const payload = unwrapGatewayPayload(
    requireGatewayResult(response, "Impossible de creer le prompt."),
  );
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

export async function generateProjectPrompts(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
): Promise<ProjectPromptRecord[]> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.projects.generatePrompts(projectId),
    {
      method: "POST",
      organizationId,
    },
  );

  const payload = unwrapGatewayPayload(
    requireGatewayResult(response, "Impossible de generer les prompts."),
  );
  const rawItems = Array.isArray(payload)
    ? payload
    : typeof payload === "object" && payload !== null && Array.isArray((payload as { items?: unknown[] }).items)
      ? (payload as { items: unknown[] }).items
      : [];

  return rawItems
    .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
    .map(normalizeProjectPromptRecord)
    .filter((item) => item.id !== "" && item.text !== "");
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

  requireGatewayResult(response, "Impossible d'enregistrer le prompt.");
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

  requireGatewayResult(response, "Impossible de supprimer le prompt.");
}
