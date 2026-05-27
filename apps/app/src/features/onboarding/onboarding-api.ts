import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import { storeSelectedOrganizationID } from "@/shared/selection";

export type OnboardingCompetitor = {
  name: string;
  website: string;
};

export type OnboardingPrompt = {
  text: string;
  language: string;
};

type CreateOnboardingProjectInput = {
  organizationId: string;
  organizationName: string;
  brandName: string;
  websiteUrl: string;
  attributionSource: string;
  brandDescription: string;
  industry: string;
  competitors: OnboardingCompetitor[];
  prompts: OnboardingPrompt[];
  modelIds: string[];
};

export type OnboardingBrandProfilePreview = {
  status: string;
  crawlJobId?: string;
  brandName: string;
  brandShortDescription: string;
  brandDescription: string;
  industry: string;
  keyFeatures: string[];
  competitors: OnboardingCompetitor[];
  prompts: OnboardingPrompt[];
};

type JsonRecord = Record<string, unknown>;
type OnboardingProjectResult = {
  projectId: string;
  projectSlug: string;
  organizationId: string;
  warnings: string[];
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null;
}

function unwrapData(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) return value.data;
  return value;
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
    : [];
}

function normalizePreviewCompetitors(value: unknown): OnboardingCompetitor[] {
  return Array.isArray(value)
    ? value
        .filter(isRecord)
        .map((item) => ({
          name: getString(item.name),
          website: getString(item.website),
        }))
        .filter((item) => item.name !== "")
    : [];
}

function normalizePreviewPrompts(value: unknown): OnboardingPrompt[] {
  return Array.isArray(value)
    ? value
        .filter(isRecord)
        .map((item) => ({
          text: getString(item.text),
          language: getString(item.language) || "fr",
        }))
        .filter((item) => item.text !== "")
    : [];
}

export async function createOnboardingProject(
  apiBaseURL: string,
  input: CreateOnboardingProjectInput,
): Promise<OnboardingProjectResult> {
  const brandName = input.brandName.trim();
  const websiteUrl = input.websiteUrl.trim();
  const organizationId = input.organizationId.trim();
  const organizationName = input.organizationName.trim();
  const modelIds = input.modelIds.map((modelId) => modelId.trim()).filter(Boolean);

  if (!brandName) {
    throw new Error("Le nom du projet est obligatoire.");
  }
  if (!websiteUrl) {
    throw new Error("L'URL du site est obligatoire.");
  }
  if (!organizationId && !organizationName) {
    throw new Error("Le nom de l'organisation est obligatoire.");
  }
  if (modelIds.length === 0) {
    throw new Error("Selectionne au moins un modele IA.");
  }

  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    apiRoutes.onboarding.bootstrap(),
    {
      method: "POST",
      body: JSON.stringify({
        organizationId,
        organizationName,
        brandName,
        websiteUrl,
        brandDescription: input.brandDescription.trim(),
        industry: input.industry.trim(),
        attributionSource: input.attributionSource.trim(),
        competitors: input.competitors,
        prompts: input.prompts,
        modelIds,
      }),
    },
  );
  if (!response.ok) {
    throw new Error(response.error || "Impossible de finaliser l'onboarding.");
  }

  const payload = unwrapData(response.data);
  const record = isRecord(payload) ? payload : {};
  const projectId = getIDString(record.projectId ?? record.projectID ?? record.id);
  const createdProjectOrganizationId = getIDString(
    record.organizationId ?? record.organizationID,
  );
  const createdProjectSlug = getString(record.projectSlug) || projectId;
  const warnings = Array.isArray(record.warnings)
    ? record.warnings.filter((warning): warning is string => typeof warning === "string")
    : [];

  if (!projectId || !createdProjectOrganizationId) {
    throw new Error("L'onboarding a reussi mais la reponse est incomplete.");
  }
  storeSelectedOrganizationID(createdProjectOrganizationId);

  return {
    projectId,
    projectSlug: createdProjectSlug,
    organizationId: createdProjectOrganizationId,
    warnings,
  };
}

export async function previewOnboardingBrandProfile(
  apiBaseURL: string,
  input: {
    websiteUrl: string;
    brandName: string;
  },
  signal?: AbortSignal,
): Promise<OnboardingBrandProfilePreview> {
  const response = await gatewayJSON<unknown>(
    apiBaseURL,
    "/onboarding/brand-profile",
    {
      method: "POST",
      signal,
      body: JSON.stringify({
        websiteUrl: input.websiteUrl.trim(),
        brandName: input.brandName.trim(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(response.error || "Impossible de preparer le profil de marque.");
  }

  const payload = unwrapData(response.data);
  const record = isRecord(payload) ? payload : {};

  return {
    status: getString(record.status) || "completed",
    crawlJobId: getString(record.crawlJobId) || undefined,
    brandName: getString(record.brandName),
    brandShortDescription: getString(record.brandShortDescription),
    brandDescription: getString(record.brandDescription),
    industry: getString(record.industry),
    keyFeatures: getStringArray(record.keyFeatures),
    competitors: normalizePreviewCompetitors(record.competitors),
    prompts: normalizePreviewPrompts(record.prompts),
  };
}
