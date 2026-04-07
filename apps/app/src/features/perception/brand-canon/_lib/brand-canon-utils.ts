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

export function buildBackSearch(search: string): string {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("tab");
  const query = params.toString();
  return query ? `?${query}` : "";
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
