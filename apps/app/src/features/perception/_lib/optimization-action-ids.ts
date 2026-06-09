const PERCEPTION_SOURCE_PREFIX = "perception:";

function uniqueIds(ids: string[]): string[] {
  return Array.from(new Set(ids.map((id) => id.trim()).filter(Boolean)));
}

export function toCanonicalPerceptionSourceErrorId(errorId: string): string {
  const normalized = errorId.trim();
  if (normalized === "" || normalized.includes(":")) return normalized;
  return `${PERCEPTION_SOURCE_PREFIX}${normalized}`;
}

export function getOptimizationActionMatchIds(sourceErrorId?: string | null): string[] {
  const normalized = (sourceErrorId ?? "").trim();
  if (!normalized) return [];

  if (normalized.startsWith(PERCEPTION_SOURCE_PREFIX)) {
    return uniqueIds([normalized, normalized.slice(PERCEPTION_SOURCE_PREFIX.length)]);
  }

  if (!normalized.includes(":")) {
    return uniqueIds([normalized, `${PERCEPTION_SOURCE_PREFIX}${normalized}`]);
  }

  return [normalized];
}
