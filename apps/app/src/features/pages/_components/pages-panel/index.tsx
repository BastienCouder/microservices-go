"use client";

import { RotateCcw } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { usePagesPanelViewModel } from "../../_lib/pages-panel/use-pages-panel-view-model";
import { CitationSourcesPanel } from "./citation-sources-panel";
import { ModelLeaderboard } from "./model-leaderboard";
import { OpportunitiesPanel } from "./opportunities-panel";
import { PageDetailPanel } from "./page-detail-panel";
import { TopPagesList } from "./top-pages-list";

type PagesPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PagesPanel({ apiBaseURL, routeSearch }: PagesPanelProps) {
  const viewModel = usePagesPanelViewModel({ apiBaseURL, routeSearch });

  if (viewModel.unavailable || (!viewModel.loading && !viewModel.metrics)) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
        <PageHeader
          title="Pages"
          baseline="Identifiez les pages de votre site réellement citées par les IA."
          actions={
            <Button variant="outline" onClick={() => void viewModel.refetch()}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Réessayer
            </Button>
          }
        />
        <Card className="mt-4 rounded-md border-border/60">
          <CardHeader>
            <CardTitle>Impossible de charger les pages</CardTitle>
            <CardDescription>
              {viewModel.error || "Aucune donnée de pages n'est disponible pour ce projet."}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
   <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <PageHeader
        title="Pages"
        baseline="Pilotez les URLs citées par les LLMs, les modèles qui les reprennent et les sites externes qui renforcent votre visibilité."
        actionsVariant="classic"
      />

      <div className="grid min-h-0 flex-1 gap-4 overflow-hidden xl:grid-cols-[minmax(280px,0.95fr)_minmax(0,2.05fr)]">
        <TopPagesList
          pages={viewModel.filteredPages}
          search={viewModel.search}
          onSearchChange={viewModel.setSearch}
          selectedPageUrl={viewModel.selectedPageUrl}
          onSelectPage={viewModel.setSelectedPageUrl}
          loading={viewModel.loading}
        />
        <div className="min-h-0 overflow-y-auto pr-1">
          <div className="grid min-h-0 gap-4">
            <PageDetailPanel page={viewModel.selectedPage} loading={viewModel.loading} />
            <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              <CitationSourcesPanel
                sources={viewModel.citationSources}
                loading={viewModel.loading}
              />
              <ModelLeaderboard models={viewModel.modelLeaders} loading={viewModel.loading} />
              <OpportunitiesPanel
                opportunities={viewModel.opportunities}
                loading={viewModel.loading}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
