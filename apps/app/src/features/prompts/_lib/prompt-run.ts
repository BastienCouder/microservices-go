import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, requireGatewayResult } from "@/shared/api/gateway";
import type { PromptItem } from "./types";

const MANUAL_PROMPT_ANALYSIS_TIMEOUT_MS = 120_000;

export type RunnablePrompt = Pick<PromptItem, "id" | "sourcePromptId" | "prompt" | "models"> & {
  modelCreditCostSum?: number;
};

type BuildStartPromptAnalysisPayloadInput = {
  projectId: string;
  prompt: RunnablePrompt;
  now?: Date;
};

type StartPromptAnalysisInput = BuildStartPromptAnalysisPayloadInput & {
  apiBaseURL: string;
  organizationId: string;
};

type StartPromptAnalysesInput = {
  apiBaseURL: string;
  organizationId: string;
  projectId: string;
  prompts: RunnablePrompt[];
  now?: Date;
};

export type StartPromptAnalysisPayload = {
  requestId: string;
  promptTexts: Array<{ id: string; text: string }>;
  modelIds: string[];
  modelCreditCostSum: number;
  runType: "manual";
};

function dedupeValues(values: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    unique.push(trimmed);
  }

  return unique;
}

function buildRequestId(projectId: string, promptId: string, modelIds: string[], now: Date): string {
  return `manual:${projectId}:${promptId}:${modelIds.join(",")}:${now.toISOString()}`;
}

export function buildStartPromptAnalysisPayload({
  projectId,
  prompt,
  now = new Date(),
}: BuildStartPromptAnalysisPayloadInput): StartPromptAnalysisPayload {
  const normalizedProjectId = projectId.trim();
  const promptId = (prompt.sourcePromptId || prompt.id).trim();
  const promptText = prompt.prompt.trim();
  const modelIds = dedupeValues(prompt.models);

  if (!normalizedProjectId) {
    throw new Error("Le projet est introuvable.");
  }

  if (!promptId || !promptText) {
    throw new Error("Le prompt est introuvable.");
  }

  if (modelIds.length === 0) {
    throw new Error("Aucun modele n'est disponible pour ce prompt.");
  }

  return {
    requestId: buildRequestId(normalizedProjectId, promptId, modelIds, now),
    promptTexts: [{ id: promptId, text: promptText }],
    modelIds,
    modelCreditCostSum: Math.max(
      1,
      Math.floor(prompt.modelCreditCostSum ?? modelIds.length),
    ),
    runType: "manual",
  };
}

export async function startPromptAnalysis({
  apiBaseURL,
  organizationId,
  projectId,
  prompt,
  now,
}: StartPromptAnalysisInput): Promise<void> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.analysis.analyze(projectId),
    {
      method: "POST",
      organizationId,
      timeoutMs: MANUAL_PROMPT_ANALYSIS_TIMEOUT_MS,
      body: JSON.stringify(buildStartPromptAnalysisPayload({ projectId, prompt, now })),
    },
  );

  requireGatewayResult(response, "Impossible de lancer le prompt.");
}

export async function startPromptAnalyses({
  apiBaseURL,
  organizationId,
  projectId,
  prompts,
  now,
}: StartPromptAnalysesInput): Promise<void> {
  for (const prompt of prompts) {
    await startPromptAnalysis({
      apiBaseURL,
      organizationId,
      projectId,
      prompt,
      now,
    });
  }
}
