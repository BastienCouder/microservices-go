import {
  BrandCanonLoadingState,
  BrandCanonUnavailableState,
} from "@/features/perception/_components";
import { usePerceptionData } from "@/features/perception/core/use-perception-data";

import { BrandCanonEditorPanel } from "./_components";
import { normalizeBrandCanonSearch } from "./_lib/brand-canon-utils";

type BrandCanonPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandCanonPage({ apiBaseURL, routeSearch }: BrandCanonPageProps) {
  const normalizedRouteSearch = normalizeBrandCanonSearch(routeSearch);
  const { data, error, loading, reload } = usePerceptionData(
    apiBaseURL,
    normalizedRouteSearch,
  );

  if (loading && !data) {
    return <BrandCanonLoadingState />;
  }

  if (!data) {
    return <BrandCanonUnavailableState error={error} onReload={reload} />;
  }

  return (
    <BrandCanonEditorPanel
      initialData={data}
      apiBaseURL={apiBaseURL}
      routeSearch={normalizedRouteSearch}
    />
  );
}
