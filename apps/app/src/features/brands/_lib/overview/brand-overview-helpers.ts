import type { BrandCanon } from "@/lib/perception-data";

const BRAND_CANON_EDITOR_PATH = "/perception/brand-canon";

export function deriveShortDescription(canon: BrandCanon): string {
  const positioning = canon.positioning.trim();
  if (!positioning) return canon.category.trim();

  const sentence = positioning.split(/(?<=[.!?])\s+/)[0]?.trim() ?? "";
  if (sentence.length > 0 && sentence.length <= 180) {
    return sentence;
  }

  return `${positioning.slice(0, 177).trimEnd()}...`;
}

export function buildBrandCanonEditorTo(
  routeSearch: string,
  tab: "brand" | "competitors",
) {
  const params = new URLSearchParams(routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch);
  params.set("tab", tab);
  const query = params.toString();

  return {
    pathname: BRAND_CANON_EDITOR_PATH,
    search: query ? `?${query}` : "",
  };
}
