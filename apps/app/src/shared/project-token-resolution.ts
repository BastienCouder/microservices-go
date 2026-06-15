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

async function loadProjectTokenCandidates(
  apiBaseURL: string,
  input: {
    organizationId?: string;
    signal?: AbortSignal;
  },
) {
  return gatewayJSON<unknown>(apiBaseURL, "/projects", {
    method: "GET",
    organizationId: input.organizationId,
    signal: input.signal,
  });
}

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

  const scopedResponse = await loadProjectTokenCandidates(apiBaseURL, input);
  const scopedMatch = scopedResponse.ok
    ? normalizeProjectTokenCandidates(scopedResponse.data).find(
        (candidate) =>
          candidate.id === projectToken || candidate.slug === projectToken,
      )
    : null;
  if (scopedMatch) {
    return {
      projectId: scopedMatch.id,
      projectSlug: scopedMatch.slug,
      organizationId: scopedMatch.organizationId,
    };
  }

  if (input.organizationId?.trim()) {
    const unscopedResponse = await loadProjectTokenCandidates(apiBaseURL, {
      signal: input.signal,
    });
    if (!unscopedResponse.ok) return null;

    const unscopedMatch = normalizeProjectTokenCandidates(unscopedResponse.data).find(
      (candidate) =>
        candidate.id === projectToken || candidate.slug === projectToken,
    );
    if (!unscopedMatch) return null;

    return {
      projectId: unscopedMatch.id,
      projectSlug: unscopedMatch.slug,
      organizationId: unscopedMatch.organizationId,
    };
  }

  return null;
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
