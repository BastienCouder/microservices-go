import {
  BrandCanonLoadingState,
  BrandCanonUnavailableState,
} from "@/features/perception/_components";
import { usePerceptionData } from "@/features/perception/core/use-perception-data";

import { BrandCanonEditorPageClient } from "./client";

type BrandCanonPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandCanonPage({ apiBaseURL, routeSearch }: BrandCanonPageProps) {
  const { data, error, loading, reload } = usePerceptionData(
    apiBaseURL,
    routeSearch,
  );

  if (loading && !data) {
    return <BrandCanonLoadingState />;
  }

  if (!data) {
    return <BrandCanonUnavailableState error={error} onReload={reload} />;
  }

  return (
    <BrandCanonEditorPageClient
      initialData={data}
      apiBaseURL={apiBaseURL}
      routeSearch={routeSearch}
    />
  );
}
