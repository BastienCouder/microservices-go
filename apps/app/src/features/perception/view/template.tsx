import { useMemo } from "react";
import { createEmptyPerceptionViewData } from "../_lib/shared/perception-data";
import { PerceptionLoadingState } from "../_components";
import { usePerceptionData } from "../_lib/shared/use-perception-data";
import { PerceptionClient } from "./client";

type PerceptionTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PerceptionTemplate({
  apiBaseURL,
  routeSearch,
}: PerceptionTemplateProps) {
  const { data, error, loading } = usePerceptionData(apiBaseURL, routeSearch);
  const emptyData = useMemo(() => createEmptyPerceptionViewData(routeSearch, error), [error, routeSearch]);

  if (loading && !data) {
    return <PerceptionLoadingState />;
  }

  return <PerceptionClient initialData={data ?? emptyData} />;
}
