import { Navigate } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";

import { ProviderApiKeysPanel } from "../provider-keys/provider-api-keys-panel";
import {
  PROVIDER_API_KEY_TEXTS,
  useModelsPanelViewModel,
} from "../../_lib/models-panel/use-models-panel-view-model";
import { DeveloperPlanHeroBanner } from "./developer-plan-hero-banner";
import { ModelCatalogGrid } from "./model-catalog-grid";
import { ModelsStatusMessage } from "./models-status-message";
import { ModelsToolbar } from "./models-toolbar";
import {
  CatalogTemplate,
  DeveloperPlanHeroBannerTemplate,
  ProviderApiKeysPanelTemplate,
} from "./template";

type ModelsPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ModelsPanel({ apiBaseURL, routeSearch }: ModelsPanelProps) {
  const viewModel = useModelsPanelViewModel({ apiBaseURL, routeSearch });

  if (viewModel.redirectHref) {
    return <Navigate to={viewModel.redirectHref} replace />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title="Modeles"
        baseline="Choisissez directement les modeles actifs pour le projet."
        actionsVariant="classic"
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

      <div className="flex flex-1 flex-col rounded-md bg-background">
        <ModelsStatusMessage
          error={viewModel.displayError}
          message={viewModel.message}
        />

        {viewModel.loadingPlan ? (
          <div className="border-b px-4 py-4 md:px-4">
            <DeveloperPlanHeroBannerTemplate />
          </div>
        ) : viewModel.showDeveloperUpgradeBanner ? (
          <div className="border-b px-4 py-4 md:px-4">
            <DeveloperPlanHeroBanner currentPlanLabel={viewModel.planLabel} />
          </div>
        ) : null}

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
                onDraftChange={viewModel.updateProviderKeyDraft}
                onSave={viewModel.saveProviderKey}
                onDelete={viewModel.deleteProviderKey}
                texts={PROVIDER_API_KEY_TEXTS}
              />
            )}

            {viewModel.developerPlanMissingKeys ? (
              <p className="mt-3 text-sm text-destructive">
                Ajoutez une cle API pour{" "}
                {viewModel.missingProviderLabels.join(", ")} avant
                d&apos;enregistrer ces modeles.
              </p>
            ) : null}
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
        />

        <div className="px-4 py-4 md:px-6">
          {!viewModel.organizationId ? (
            <EmptyStateCard label="Selectionne d'abord une organisation." />
          ) : viewModel.loading ? <CatalogTemplate /> : viewModel.filteredCatalog.length === 0 ? (
            <EmptyStateCard label="Aucun modele disponible." />
          ) : (<>
            <ModelCatalogGrid
              models={viewModel.filteredCatalog}
              selectedModelIdSet={viewModel.selectedModelIdSet}
              selectionLimit={viewModel.selectionLimit}
              isDeveloperPlan={viewModel.isDeveloperPlan}
              providerCredentialsReady={viewModel.providerCredentialsReady}
              providerCredentials={viewModel.providerCredentials}
              providerCredentialLookup={viewModel.providerCredentialLookup}
              onToggleModel={viewModel.toggleProjectModel}
            />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
