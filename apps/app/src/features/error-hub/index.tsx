"use client";

import { useOptimizationErrors } from "../perception/core/use-optimization-errors";
import { ErrorHubKanban } from "./_components/error-hub-kanban";
import { readSourceFilterFromSearch } from "./_lib/error-hub-utils";

type ErrorHubPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ErrorHubPage({ apiBaseURL, routeSearch }: ErrorHubPageProps) {
  const {
    competitors,
    data,
    error,
    actionStatusesByErrorId,
    generatedIds,
    handleFix,
    handleMarkDone,
    loading,
    markingDoneErrorIds,
    modelCatalog,
    persistError,
    savingErrorIds,
  } = useOptimizationErrors(apiBaseURL, routeSearch);

  return (
    <ErrorHubKanban
      competitors={competitors}
      errors={data?.errors ?? []}
      actionStatusesByErrorId={actionStatusesByErrorId}
      generatedIds={generatedIds}
      initialSourceFilter={readSourceFilterFromSearch(routeSearch)}
      loading={loading && !data && !error}
      markingDoneErrorIds={markingDoneErrorIds}
      modelCatalog={modelCatalog}
      onCreateAction={handleFix}
      onMarkDone={handleMarkDone}
      persistError={persistError || error}
      savingErrorIds={savingErrorIds}
    />
  );
}