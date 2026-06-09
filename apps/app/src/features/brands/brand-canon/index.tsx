import { BrandCanonLoadingState } from "@/features/perception/_components";
import { createEmptyPerceptionViewData } from "@/features/perception/_lib/shared/perception-data";
import { usePerceptionData } from "@/features/perception/_lib/shared/use-perception-data";

import { BrandCanonEditorPanel } from "./_components";
import { normalizeBrandCanonSearch } from "./_lib/brand-canon-utils";

type BrandCanonPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandCanonPage({ apiBaseURL, routeSearch }: BrandCanonPageProps) {
  const normalizedRouteSearch = normalizeBrandCanonSearch(routeSearch);
  const { data, error, loading } = usePerceptionData(
    apiBaseURL,
    normalizedRouteSearch,
  );

  if (loading && !data) {
    return <BrandCanonLoadingState />;
  }

  return (
    <BrandCanonEditorPanel
      initialData={data ?? createEmptyPerceptionViewData(normalizedRouteSearch, error)}
      apiBaseURL={apiBaseURL}
      routeSearch={normalizedRouteSearch}
    />
  );
}
