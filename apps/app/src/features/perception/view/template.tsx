import {
  PerceptionLoadingState,
  PerceptionUnavailableState,
} from "../_components";
import { usePerceptionData } from "../core/use-perception-data";
import { PerceptionClient } from "./client";

type PerceptionTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PerceptionTemplate({
  apiBaseURL,
  routeSearch,
}: PerceptionTemplateProps) {
  const { data, error, loading, reload } = usePerceptionData(apiBaseURL, routeSearch);

  if (loading && !data) {
    return <PerceptionLoadingState />;
  }

  if (!data) {
    return <PerceptionUnavailableState error={error} />;
  }

  return <PerceptionClient initialData={data} />;
}
