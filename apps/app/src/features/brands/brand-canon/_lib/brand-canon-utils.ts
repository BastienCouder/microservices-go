import type { BrandCompetitor } from "@/lib/perception-data";
import { translateI18nText } from "@/shared/hooks/use-i18n";

export type EditorTab = "brand" | "competitors";

export function isEditorTab(value: string): value is EditorTab {
  return value === "brand" || value === "competitors";
}

export function readEditorTab(search: string): EditorTab {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const tab = params.get("tab");
  if (tab && isEditorTab(tab)) {
    return tab;
  }
  return "brand";
}

function toSearchParams(search: string): URLSearchParams {
  return new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
}

function hasProjectScope(params: URLSearchParams): boolean {
  return Boolean(
    params.get("projectId")?.trim() ||
      params.get("project_id")?.trim() ||
      params.get("project")?.trim(),
  );
}

function cleanBrandCanonSearch(params: URLSearchParams): string {
  params.delete("brand");
  params.delete("tab");
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function normalizeBrandCanonSearch(search: string): string {
  const params = toSearchParams(search);

  if (hasProjectScope(params)) {
    return cleanBrandCanonSearch(params);
  }

  const legacyBrandSearch = params.get("brand")?.trim() ?? "";
  if (legacyBrandSearch) {
    const legacyParams = toSearchParams(legacyBrandSearch);
    if (hasProjectScope(legacyParams)) {
      return cleanBrandCanonSearch(legacyParams);
    }
  }

  return cleanBrandCanonSearch(params);
}

export function buildBrandCanonLocation(search: string) {
  return {
    pathname: "/brand-canon" as const,
    search: normalizeBrandCanonSearch(search),
  };
}

export function buildBackSearch(search: string): string {
  return normalizeBrandCanonSearch(search);
}

export function buildBrandsLocation(search: string) {
  return {
    pathname: "/brands" as const,
    search: buildBackSearch(search),
  };
}

export function sanitizeList(items: string[]): string[] {
  const seen = new Set<string>();
  const nextItems: string[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    const lower = trimmed.toLowerCase();
    if (!trimmed || seen.has(lower)) continue;
    seen.add(lower);
    nextItems.push(trimmed);
  }

  return nextItems;
}

export function validateCompetitors(
  competitors: BrandCompetitor[],
  locale = "en",
): string | null {
  const seen = new Set<string>();

  for (const competitor of competitors) {
    const name = competitor.name.trim();
    if (!name) {
      return translateI18nText(
        "perception-brand-canon",
        "validationMissingCompetitorName",
        locale,
      );
    }

    const key = name.toLowerCase();
    if (seen.has(key)) {
      return translateI18nText(
        "perception-brand-canon",
        "validationUniqueCompetitor",
        locale,
      );
    }
    seen.add(key);
  }

  return null;
}
