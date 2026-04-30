import { BrandsOverviewPanel } from "./_components/overview";
import { normalizeBrandCanonSearch } from "./brand-canon/_lib/brand-canon-utils";

type BrandsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandsPage({ apiBaseURL, routeSearch }: BrandsPageProps) {
  return (
    <BrandsOverviewPanel
      apiBaseURL={apiBaseURL}
      routeSearch={normalizeBrandCanonSearch(routeSearch)}
    />
  );
}
