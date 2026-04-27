import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, type GatewayResult } from "@/shared/api/gateway";
import { attachStableSlugs } from "@/shared/public-slugs";
import { storeSelectedOrganizationID } from "@/shared/selection";

type OnboardingCompetitor = {
  name: string;
  website: string;
};

type OnboardingPrompt = {
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

type JsonRecord = Record<string, unknown>;
type OnboardingProjectResult = {
  projectId: string;
  projectSlug: string;
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

async function requireGatewayData<T>(
  promise: Promise<GatewayResult<T>>,
  message: string,
): Promise<T> {
  const response = await promise;
  if (!response.ok) {
    throw new Error(response.error || message);
  }
  return response.data;
}

function deriveDomain(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  const normalized = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(normalized).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return normalized
      .replace(/^https?:\/\//i, "")
      .split("/", 1)[0]
      ?.replace(/^www\./i, "")
      .toLowerCase() ?? "";
  }
}

export async function createOnboardingProject(
  apiBaseURL: string,
  input: CreateOnboardingProjectInput,
): Promise<OnboardingProjectResult> {
  let organizationId = input.organizationId.trim();
  const brandName = input.brandName.trim();
  const websiteUrl = input.websiteUrl.trim();
  const domain = deriveDomain(websiteUrl);

  if (!brandName) {
    throw new Error("Le nom du projet est obligatoire.");
  }
  if (!websiteUrl) {
    throw new Error("L'URL du site est obligatoire.");
  }
  if (!domain) {
    throw new Error("Le domaine est obligatoire.");
  }

  if (!organizationId) {
    const organizationName = input.organizationName.trim();
    if (!organizationName) {
      throw new Error("Le nom de l'organisation est obligatoire.");
    }

    const organizationPayload = await requireGatewayData(
      gatewayJSON<unknown>(apiBaseURL, apiRoutes.organizations.create(), {
        method: "POST",
        body: JSON.stringify({ name: organizationName }),
      }),
      "Impossible de creer l'organisation.",
    );
    const organization = unwrapData(organizationPayload);
    organizationId = isRecord(organization)
      ? getIDString(organization.id ?? organization.ID)
      : "";
    if (!organizationId) {
      throw new Error("L'organisation a ete creee mais son identifiant est introuvable.");
    }
    storeSelectedOrganizationID(organizationId);
  }

  const createdProjectPayload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.create(), {
      method: "POST",
      organizationId,
      body: JSON.stringify({
        name: brandName,
        websiteUrl,
        domain,
        brandName,
        brandDescription: input.brandDescription.trim(),
        industry: input.industry.trim(),
        attributionSource: input.attributionSource.trim(),
      }),
    }),
    "Impossible de creer le projet.",
  );

  const createdProject = unwrapData(createdProjectPayload);
  const projectId = isRecord(createdProject) ? getIDString(createdProject.id ?? createdProject.ID) : "";
  if (!projectId) {
    throw new Error("Le projet a ete cree mais son identifiant est introuvable.");
  }

  const competitors = input.competitors
    .map((competitor) => ({
      name: competitor.name.trim(),
      websiteUrl: competitor.website.trim(),
      domain: deriveDomain(competitor.website),
    }))
    .filter((competitor) => competitor.name !== "");

  const prompts = input.prompts
    .map((prompt) => prompt.text.trim())
    .filter(Boolean);

  const modelIds = input.modelIds.map((modelId) => modelId.trim()).filter(Boolean);

  if (competitors.length > 0) {
    await requireGatewayData(
      gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.competitors(projectId), {
        method: "POST",
        organizationId,
        body: JSON.stringify({ competitors }),
      }),
      "Impossible d'ajouter les concurrents.",
    );
  }

  if (prompts.length > 0) {
    await requireGatewayData(
      gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.prompts(projectId), {
        method: "POST",
        organizationId,
        body: JSON.stringify({ prompts }),
      }),
      "Impossible d'ajouter les prompts.",
    );
  }

  if (modelIds.length > 0) {
    await requireGatewayData(
      gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.models(projectId), {
        method: "PUT",
        organizationId,
        body: JSON.stringify({ modelIds }),
      }),
      "Impossible d'ajouter les modeles.",
    );
  }

  const projectsPayload = await requireGatewayData(
    gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.list(), {
      method: "GET",
      organizationId,
    }),
    "Impossible de charger les projets de l'organisation.",
  );
  const projectsData = unwrapData(projectsPayload);

  const projects = attachStableSlugs(
    (Array.isArray(projectsData) ? projectsData : [])
      .filter((project): project is JsonRecord => isRecord(project))
      .map((project) => ({
        id: getIDString(project.id ?? project.ID),
        name: (typeof (project.name ?? project.Name) === "string"
          ? String(project.name ?? project.Name).trim()
          : "") || "Projet",
      }))
      .filter((project) => project.id !== ""),
    "project",
  );
  const createdProjectSlug =
    projects.find((project) => project.id === projectId)?.slug ?? "project";

  return {
    projectId,
    projectSlug: createdProjectSlug,
  };
}
