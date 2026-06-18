import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, requireGatewayResult, unwrapGatewayPayload } from "@/shared/api/gateway";
import type { PromptItem } from "./types";

const DISABLE_GATEWAY_TIMEOUT_MS = 0;

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

export type StartPromptAnalysisResult = {
  runId: string;
};

function normalizeStartPromptAnalysisResult(value: unknown): StartPromptAnalysisResult {
  if (!value || typeof value !== "object") return { runId: "" };
  const record = value as Record<string, unknown>;
  const analysisRun = record.analysisRun;
  if (analysisRun && typeof analysisRun === "object") {
    const runId = (analysisRun as Record<string, unknown>).id;
    return { runId: typeof runId === "string" ? runId : "" };
  }
  return { runId: "" };
}

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
}: StartPromptAnalysisInput): Promise<StartPromptAnalysisResult> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.analysis.analyze(projectId),
    {
      method: "POST",
      organizationId,
      timeoutMs: DISABLE_GATEWAY_TIMEOUT_MS,
      body: JSON.stringify(buildStartPromptAnalysisPayload({ projectId, prompt, now })),
    },
  );

  const payload = unwrapGatewayPayload(
    requireGatewayResult(response, "Impossible de lancer le prompt."),
  );
  return normalizeStartPromptAnalysisResult(payload);
}

export async function startPromptAnalyses({
  apiBaseURL,
  organizationId,
  projectId,
  prompts,
  now,
}: StartPromptAnalysesInput): Promise<StartPromptAnalysisResult[]> {
  const results: StartPromptAnalysisResult[] = [];
  for (const prompt of prompts) {
    const result = await startPromptAnalysis({
      apiBaseURL,
      organizationId,
      projectId,
      prompt,
      now,
    });
    results.push(result);
  }
  return results;
}
