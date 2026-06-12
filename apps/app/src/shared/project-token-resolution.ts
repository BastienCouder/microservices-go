import { gatewayJSON, unwrapGatewayPayload } from "@/shared/api/gateway";
import { attachStableSlugs } from "@/shared/public-slugs";

type JsonObject = Record<string, unknown>;

type ProjectTokenCandidate = {
  id: string;
  name: string;
  slug: string;
  organizationId: string;
};

function asObject(value: unknown): JsonObject {
  return value && typeof value === "object" ? (value as JsonObject) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getField(value: JsonObject, keys: string[]): unknown {
  for (const key of keys) {
    if (key in value) return value[key];
  }
  return undefined;
}

export function normalizeProjectTokenCandidates(value: unknown): ProjectTokenCandidate[] {
  const payload = unwrapGatewayPayload(value);
  if (!Array.isArray(payload)) return [];

  return attachStableSlugs(
    payload
      .map(asObject)
      .map((entry) => ({
        id: asString(getField(entry, ["id", "ID"])),
        name: asString(getField(entry, ["name", "Name"])) || "Projet",
        organizationId: asString(
          getField(entry, ["organizationId", "OrganizationID"]),
        ),
      }))
      .filter((project) => project.id !== ""),
    "project",
  );
}

export type ResolvedProjectTokenContext = {
  projectId: string;
  projectSlug: string;
  organizationId: string;
};

export async function resolveProjectTokenToContext(
  apiBaseURL: string,
  input: {
    projectToken: string;
    organizationId?: string;
    signal?: AbortSignal;
  },
): Promise<ResolvedProjectTokenContext | null> {
  const projectToken = input.projectToken.trim();
  if (projectToken === "") return null;

  const response = await gatewayJSON<unknown>(apiBaseURL, "/projects", {
    method: "GET",
    organizationId: input.organizationId,
    signal: input.signal,
  });

  if (!response.ok) return null;

  const project = normalizeProjectTokenCandidates(response.data)
    .find(
      (candidate) =>
        candidate.id === projectToken || candidate.slug === projectToken,
    );
  if (!project) return null;

  return {
    projectId: project.id,
    projectSlug: project.slug,
    organizationId: project.organizationId,
  };
}

export async function resolveProjectTokenToId(
  apiBaseURL: string,
  input: {
    projectToken: string;
    organizationId?: string;
    signal?: AbortSignal;
  },
): Promise<string | null> {
  return (
    await resolveProjectTokenToContext(apiBaseURL, input)
  )?.projectId ?? null;
}
