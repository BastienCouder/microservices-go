export type VisibilityBrandInput = {
  name: string;
  isCompetitor: boolean;
};

export type VisibilityFallbackShare = {
  name: string;
  percentage: number;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

export function buildFallbackSovPercentages(
  brands: VisibilityBrandInput[],
  competitorSovByName: Map<string, number>,
): Map<string, number> {
  const normalized = new Map<string, number>();
  const competitorBrands = brands.filter((brand) => brand.isCompetitor);

  const competitorTotal = competitorBrands.reduce(
    (acc, brand) => acc + Math.max(0, competitorSovByName.get(brand.name) ?? 0),
    0,
  );
  const projectBrand = brands.find((brand) => !brand.isCompetitor);
  const projectRaw = projectBrand ? Math.max(0, 100 - competitorTotal) : 0;
  const visibleTotal = competitorTotal + projectRaw;

  if (visibleTotal <= 0) {
    for (const brand of brands) {
      normalized.set(brand.name, 0);
    }
    return normalized;
  }

  for (const brand of competitorBrands) {
    const raw = Math.max(0, competitorSovByName.get(brand.name) ?? 0);
    normalized.set(brand.name, round1((raw / visibleTotal) * 100));
  }

  if (projectBrand) {
    normalized.set(projectBrand.name, round1((projectRaw / visibleTotal) * 100));
  }

  return normalized;
}
