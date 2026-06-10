import { useEffect } from "react";
import { Navigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { pushWarningToast } from "@/components/ui/toast-actions";

import { ProviderApiKeysPanel } from "../provider-keys/provider-api-keys-panel";
import {
  PROVIDER_API_KEY_TEXTS,
  useModelsPanelViewModel,
} from "../../_lib/models-panel/use-models-panel-view-model";
import { ModelCatalogGrid } from "./model-catalog-grid";
import { ModelsToolbar } from "./models-toolbar";
import {
  CatalogTemplate,
  ProviderApiKeysPanelTemplate,
} from "./template";

type ModelsPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ModelsPanel({ apiBaseURL, routeSearch }: ModelsPanelProps) {
  const viewModel = useModelsPanelViewModel({ apiBaseURL, routeSearch });
  const missingProviderLabels = viewModel.missingProviderLabels.join(", ");

  useEffect(() => {
    if (viewModel.developerPlanMissingKeys) {
      pushWarningToast(
        `Ajoutez une cle API pour ${missingProviderLabels} avant d'enregistrer ces modeles.`,
      );
    }
  }, [missingProviderLabels, viewModel.developerPlanMissingKeys]);

  if (viewModel.redirectHref) {
    return <Navigate to={viewModel.redirectHref} replace />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title="IA configurées"
        baseline="Choisissez directement les modeles actifs pour le projet."
        actionsVariant="classic"
        className="rounded-xl rounded-bl-none rounded-br-none"
        meta={
          <>
            {viewModel.loading ? (
              <Skeleton className="h-6 w-28 rounded-full" />
            ) : (
              <Badge variant="default">
                {viewModel.selectedModelIds.length} selectionnes
              </Badge>
            )}
            {viewModel.loadingPlan ? (
              <Skeleton className="h-6 w-24 rounded-full" />
            ) : viewModel.planLabel ? (
              <Badge variant="outline" className="capitalize">
                plan {viewModel.planLabel}
              </Badge>
            ) : null}
            {viewModel.isDeveloperPlan ? (
              <Badge variant="outline">cles API requises</Badge>
            ) : null}
          </>
        }
      />

      <div className="flex flex-1 flex-col rounded-xl rounded-tr-none rounded-tl-none md:rounded-xl bg-background">
        {viewModel.isDeveloperPlan ? (
          <div className="border-b px-4 py-4 md:px-6">
            {viewModel.loadingProviderCredentials || viewModel.loadingCatalog ? (
              <ProviderApiKeysPanelTemplate />
            ) : (
              <ProviderApiKeysPanel
                requirements={viewModel.providerCredentialOptions}
                drafts={viewModel.providerKeyDrafts}
                pendingProvider={viewModel.pendingProvider}
                disabled={viewModel.providerKeysDisabled}
                canEdit={viewModel.canEdit}
                onDraftChange={viewModel.updateProviderKeyDraft}
                onSave={viewModel.saveProviderKey}
                onDelete={viewModel.deleteProviderKey}
                texts={PROVIDER_API_KEY_TEXTS}
              />
            )}
          </div>
        ) : null}

        <ModelsToolbar
          search={viewModel.search}
          selectedCount={viewModel.selectedModelIds.length}
          selectionLimit={viewModel.selectionLimit}
          saveDisabled={viewModel.saveDisabled}
          isSavingModels={viewModel.isSavingModels}
          loading={viewModel.loading}
          onSearchChange={viewModel.setSearch}
          onSave={viewModel.saveSelectedModels}
          canEdit={viewModel.canEdit}
        />

        <div className="px-4 py-4 md:px-6">
          {!viewModel.organizationId ? (
            <EmptyStateCard label="Selectionne d'abord une organisation." />
          ) : viewModel.loading ? <CatalogTemplate /> : viewModel.filteredCatalog.length === 0 ? (
            <EmptyStateCard label={viewModel.displayError || "Aucun modele disponible."} />
          ) : (<>
            <ModelCatalogGrid
              models={viewModel.filteredCatalog}
              selectedModelIdSet={viewModel.selectedModelIdSet}
              selectionLimit={viewModel.selectionLimit}
              isDeveloperPlan={viewModel.isDeveloperPlan}
              providerCredentialsReady={viewModel.providerCredentialsReady}
              providerCredentials={viewModel.providerCredentials}
              providerCredentialLookup={viewModel.providerCredentialLookup}
              canEdit={viewModel.canEdit}
              onToggleModel={viewModel.toggleProjectModel}
            />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
