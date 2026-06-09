"use client";

import { useOptimizationErrors } from "../perception/_lib/shared/use-optimization-errors";
import type { OptimizationError } from "../perception/_lib/shared/optimization-errors-data";
import { ErrorHubKanban } from "./_components/error-hub-kanban";
import { readSourceFilterFromSearch } from "./_lib/error-hub-utils";

type ErrorHubPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

function isErrorHubError(error: OptimizationError) {
  return error.source !== "monitoring" || error.origin !== "derived";
}

export function ErrorHubPage({ apiBaseURL, routeSearch }: ErrorHubPageProps) {
  const {
    competitors,
    canGenerateAiBrief,
    data,
    error,
    actionStatusesByErrorId,
    generatedContentByErrorId,
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
      errors={(data?.errors ?? []).filter(isErrorHubError)}
      canGenerateAiBrief={canGenerateAiBrief}
      actionStatusesByErrorId={actionStatusesByErrorId}
      generatedContentByErrorId={generatedContentByErrorId}
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
