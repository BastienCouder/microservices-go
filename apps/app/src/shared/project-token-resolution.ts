import { gatewayJSON } from "@/shared/api/gateway";
import { attachStableSlugs, findBySlugOrId } from "@/shared/public-slugs";

type JsonObject = Record<string, unknown>;

type ProjectTokenCandidate = {
  id: string;
  name: string;
  slug: string;
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

function unwrapSuccessEnvelope(value: unknown): unknown {
  const payload = asObject(value);
  if (payload.success === true && "data" in payload) {
    return payload.data;
  }
  return value;
}

export function normalizeProjectTokenCandidates(value: unknown): ProjectTokenCandidate[] {
  const payload = unwrapSuccessEnvelope(value);
  if (!Array.isArray(payload)) return [];

  return attachStableSlugs(
    payload
      .map(asObject)
      .map((entry) => ({
        id: asString(getField(entry, ["id", "ID"])),
        name: asString(getField(entry, ["name", "Name"])) || "Projet",
      }))
      .filter((project) => project.id !== ""),
    "project",
  );
}

export async function resolveProjectTokenToId(
  apiBaseURL: string,
  input: {
    projectToken: string;
    organizationId?: string;
    signal?: AbortSignal;
  },
): Promise<string | null> {
  const projectToken = input.projectToken.trim();
  if (projectToken === "") return null;

  const response = await gatewayJSON<unknown>(apiBaseURL, "/projects", {
    method: "GET",
    organizationId: input.organizationId,
    signal: input.signal,
  });

  if (!response.ok) return null;

  return findBySlugOrId(normalizeProjectTokenCandidates(response.data), projectToken)?.id ?? null;
}
