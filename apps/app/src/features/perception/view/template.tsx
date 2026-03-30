import { BrandCanonEditorPageClient } from "../brand-canon/view/client";
import {
  BrandCanonLoadingState,
  BrandCanonUnavailableState,
  PerceptionLoadingState,
  PerceptionUnavailableState,
} from "../_components";
import { usePerceptionData } from "../core/use-perception-data";
import { PerceptionClient } from "./client";

type PerceptionTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
  brandCanonMode?: boolean;
};

export function PerceptionTemplate({
  apiBaseURL,
  routeSearch,
  brandCanonMode = false,
}: PerceptionTemplateProps) {
  const { data, error, loading, reload } = usePerceptionData(apiBaseURL, routeSearch);

  if (loading && !data) {
    return brandCanonMode ? <BrandCanonLoadingState /> : <PerceptionLoadingState />;
  }

  if (!data) {
    return brandCanonMode ? (
      <BrandCanonUnavailableState error={error} onReload={reload} />
    ) : (
      <PerceptionUnavailableState error={error} />
    );
  }

  if (brandCanonMode) {
    return (
      <BrandCanonEditorPageClient
        initialData={data}
        apiBaseURL={apiBaseURL}
        routeSearch={routeSearch}
      />
    );
  }

  return <PerceptionClient initialData={data} />;
}
