import { API_CONFIG, apiRoutes } from "@/lib/api-config";
import type { BrandCanon, BrandCompetitor } from "@/lib/perception-data";
import { SELECTED_ORG_KEY } from "@/features/models/_lib/model-access";
import { gatewayJSON } from "@/shared/api/gateway";

function readSelectedOrganizationId(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(SELECTED_ORG_KEY)?.trim() ?? "";
  } catch {
    return "";
  }
}

async function requestJson<T>(path: string, init: RequestInit): Promise<T> {
  const organizationId = readSelectedOrganizationId();
  const result = await gatewayJSON<unknown>(API_CONFIG.BASE_URL, path, {
    ...init,
    organizationId: organizationId || undefined,
  });

  if (!result.ok) throw new Error(result.error || `HTTP ${result.status}`);
  if (result.status === 204 || result.data === null) return undefined as T;

  const json = result.data;
  if (json && typeof json === "object" && "data" in json) {
    return (json as { data: T }).data;
  }
  return json as T;
}

export async function saveBrandCanonProject(
  projectId: string,
  canon: BrandCanon,
): Promise<BrandCanon> {
  await requestJson(apiRoutes.projects.get(projectId), {
    method: "PATCH",
    body: JSON.stringify({
      brandName: canon.brandName,
      brandDescription: canon.positioning,
      industry: canon.category,
    }),
  });

  return requestJson<BrandCanon>(apiRoutes.analysis.brandCanon(projectId), {
    method: "PATCH",
    body: JSON.stringify({
      brandName: canon.brandName,
      category: canon.category,
      positioning: canon.positioning,
      audience: canon.audience,
      useCases: canon.useCases,
      features: canon.features,
    }),
  });
}

export async function syncCompetitors(
  projectId: string,
  previousCompetitors: BrandCompetitor[],
  nextCompetitors: BrandCompetitor[],
): Promise<void> {
  const normalizedNext = nextCompetitors.map((competitor) => ({
    ...competitor,
    name: competitor.name.trim(),
    website: competitor.website.trim(),
  }));

  const previousById = new Map(
    previousCompetitors
      .filter((competitor): competitor is BrandCompetitor & { id: string } => Boolean(competitor.id))
      .map((competitor) => [competitor.id, competitor]),
  );
  const nextById = new Map(
    normalizedNext
      .filter((competitor): competitor is BrandCompetitor & { id: string } => Boolean(competitor.id))
      .map((competitor) => [competitor.id, competitor]),
  );

  const competitorsToDelete = previousCompetitors.filter((competitor): competitor is BrandCompetitor & { id: string } => {
    if (!competitor.id) return false;
    return !nextById.has(competitor.id);
  });
  const competitorsToCreate = normalizedNext.filter((competitor) => !competitor.id);
  const competitorsToUpdate = normalizedNext.filter((competitor) => {
    if (!competitor.id) return false;
    const previous = previousById.get(competitor.id);
    return Boolean(previous) && (previous!.name !== competitor.name || previous!.website !== competitor.website);
  });

  await Promise.all([
    ...competitorsToUpdate.map((competitor) =>
      requestJson(apiRoutes.competitors.update(competitor.id!), {
        method: "PATCH",
        body: JSON.stringify({
          name: competitor.name,
          websiteUrl: competitor.website,
        }),
      }),
    ),
    ...competitorsToDelete.map((competitor) =>
      requestJson(apiRoutes.competitors.delete(competitor.id), {
        method: "DELETE",
      }),
    ),
  ]);

  if (competitorsToCreate.length > 0) {
    await requestJson(apiRoutes.projects.competitors(projectId), {
      method: "POST",
      body: JSON.stringify({
        competitors: competitorsToCreate.map((competitor) => ({
          name: competitor.name,
          websiteUrl: competitor.website,
        })),
      }),
    });
  }
}
