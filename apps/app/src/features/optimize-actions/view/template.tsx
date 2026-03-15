"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  RefreshCcw,
  Target,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardSectionTitle } from "@/features/monitoring/components/dashboard-section-title";
import { usePerceptionData } from "@/features/perception/core/use-perception-data";
import { PageHeader } from "@/features/shared/view/page-header";
import {
  formatPerceptionFixTypeLabel,
  formatPerceptionPriorityLabel,
  formatPerceptionStatusLabel,
  getModelIconForName,
} from "@/lib/app-data";
import { apiRoutes } from "@/lib/api-config";
import { type OptimizePriority, type PerceptionError } from "@/lib/perception-data";
import { appQueryKeys } from "@/lib/query-keys";
import { toSafeImageAssetPath } from "@/lib/safe-asset-path";
import { gatewayJSON } from "@/shared/api/gateway";
import { cn } from "@/shared/utils";

type OptimizeActionsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

type OptimizeActionRecord = {
  id: string;
  priority: OptimizePriority;
  type: string;
  title: string;
  issue: string;
  impact: string;
  generatedContent: string;
  status: string;
  sourceErrorId: string;
  metadata: {
    aiModels: string[];
    promptsCount: number;
  };
  createdAt: string;
  updatedAt: string;
};

type OptimizeBoardItem = {
  id: string;
  kind: "action" | "suggestion";
  priority: OptimizePriority;
  type: string;
  title: string;
  issue: string;
  impact: string;
  generatedContent: string;
  status: string | null;
  models: string[];
  promptsCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  sourceErrorId: string | null;
};

export function OptimizeActionsTemplate({ apiBaseURL, routeSearch }: OptimizeActionsTemplateProps) {
  const routeProjectId = useMemo(() => readProjectIdFromSearch(routeSearch), [routeSearch]);
  const { data: perceptionData, loading: perceptionLoading, reload: reloadPerception } = usePerceptionData(
    apiBaseURL,
    routeSearch,
  );
  const resolvedProjectId = routeProjectId ?? perceptionData?.metadata.projectId ?? null;
  const [search, setSearch] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const actionsQuery = useQuery({
    queryKey: appQueryKeys.optimizeActions(apiBaseURL, resolvedProjectId),
    enabled: apiBaseURL.trim() !== "" && Boolean(resolvedProjectId),
    queryFn: ({ signal }) => loadOptimizeActions(apiBaseURL, resolvedProjectId!, signal),
  });

  const createMutation = useMutation({
    mutationFn: async (error: PerceptionError) => {
      if (!resolvedProjectId) {
        throw new Error("Aucun projet sélectionné");
      }
      return createOptimizeAction(apiBaseURL, resolvedProjectId, error);
    },
    onSuccess: async () => {
      await Promise.all([actionsQuery.refetch(), reloadPerception()]);
    },
  });

  const actions = actionsQuery.data ?? [];
  const actionSourceIds = useMemo(
    () => new Set(actions.map((action) => action.sourceErrorId).filter(Boolean)),
    [actions],
  );
  const suggestions = useMemo(
    () => (perceptionData?.topErrors ?? []).filter((error) => !actionSourceIds.has(error.id)),
    [actionSourceIds, perceptionData?.topErrors],
  );

  const boardItems = useMemo(() => buildBoardItems(actions, suggestions), [actions, suggestions]);

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return boardItems;
    return boardItems.filter((item) =>
      [
        item.title,
        item.issue,
        item.impact,
        item.generatedContent,
        item.type,
        item.status ?? "",
        item.models.join(" "),
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [boardItems, search]);

  useEffect(() => {
    if (filteredItems.length === 0) {
      setSelectedItemId(null);
      return;
    }

    if (!selectedItemId || !filteredItems.some((item) => item.id === selectedItemId)) {
      setSelectedItemId(filteredItems[0]!.id);
    }
  }, [filteredItems, selectedItemId]);

  const selectedItem = filteredItems.find((item) => item.id === selectedItemId) ?? filteredItems[0] ?? null;
  const columns = useMemo(() => buildKanbanColumns(filteredItems), [filteredItems]);
  const summary = useMemo(() => buildOptimizeSummary(actions, suggestions), [actions, suggestions]);
  const actionsError = actionsQuery.error instanceof Error ? actionsQuery.error.message : null;
  const creationError = createMutation.error instanceof Error ? createMutation.error.message : null;

  if (!resolvedProjectId && perceptionLoading) {
    return <OptimizeActionsLoadingState />;
  }

  if (!resolvedProjectId) {
    return <OptimizeActionsProjectRequiredState />;
  }

  if (actionsQuery.isLoading && perceptionLoading && actions.length === 0 && !perceptionData) {
    return <OptimizeActionsLoadingState />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title="Actions d'optimisation"
        baseline="Visualisez directement quoi traiter d'abord grâce à un kanban trié par urgence."
        meta={
          <>
            <Badge variant="outline">{perceptionData?.brandCanon.brandName || resolvedProjectId}</Badge>
            <Badge variant="outline">{summary.totalActions} au backlog</Badge>
            {summary.pendingSuggestions > 0 ? <Badge variant="outline">{summary.pendingSuggestions} à ajouter</Badge> : null}
          </>
        }
        actionsVariant="classic"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => void Promise.all([actionsQuery.refetch(), reloadPerception()])}>
              <RefreshCcw className="mr-2 h-4 w-4" />
              Actualiser
            </Button>
            <Button asChild variant="default">
              <Link to={{ pathname: "/perception", search: routeSearch }}>
                Voir la perception
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        }
      />

      {actionsError ? (
        <div className="mt-4 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Impossible de relire l’historique des actions pour le moment. Les suggestions détectées restent néanmoins
          visibles ci-dessous.
        </div>
      ) : null}

      {creationError ? (
        <div className="mt-4 rounded-2xl border border-rose-300/60 bg-rose-50 px-4 py-3 text-sm text-rose-900">
          {creationError}
        </div>
      ) : null}

      <Card className="mt-4 border-border/60 rounded-tr-none">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="max-w-2xl">
            <div className="text-sm font-semibold text-foreground">Lecture rapide</div>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Les cartes sont rangées automatiquement par urgence. Les suggestions non encore ajoutées apparaissent
              dans la même colonne que les actions déjà créées.
            </p>
          </div>
          <div className="w-full md:w-[340px]">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Rechercher une action, un modèle ou un type"
            />
          </div>
        </CardContent>
      </Card>

      {filteredItems.length === 0 ? (
        <div className="mt-4">
          <OptimizeActionsEmptyState hasSuggestions={suggestions.length > 0} routeSearch={routeSearch} />
        </div>
      ) : null}

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {KANBAN_COLUMN_ORDER.map((priority) => {
          const column = columns[priority];
          return (
            <Card
              key={priority}
              className={cn(
                "border-border/60 align-start",
                priority === "high" ? "border-rose-300/60 bg-rose-50/35" : "",
                priority === "medium" ? "border-amber-300/60 bg-amber-50/35" : "",
                priority === "low" ? "border-emerald-300/60 bg-emerald-50/30" : "",
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="text-base">
                      <DashboardSectionTitle>{getPriorityColumnTitle(priority)}</DashboardSectionTitle>
                    </CardTitle>
                    <CardDescription>{getPriorityColumnDescription(priority)}</CardDescription>
                  </div>
                  <Badge variant="outline">{column.length}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                {column.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-border/70 bg-background/75 px-4 py-10 text-sm text-muted-foreground">
                    Rien dans cette colonne pour l’instant.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {column.map((item) => {
                      const isActive = selectedItem?.id === item.id;
                      const suggestionError =
                        item.kind === "suggestion"
                          ? suggestions.find((entry) => `suggestion:${entry.id}` === item.id)
                          : null;
                      const isSaving = Boolean(
                        suggestionError &&
                          createMutation.isPending &&
                          createMutation.variables?.id === suggestionError.id,
                      );

                      return (
                        <div
                          key={item.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedItemId(item.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setSelectedItemId(item.id);
                            }
                          }}
                          className={cn(
                            "w-full cursor-pointer rounded-2xl border bg-background/90 p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                            isActive ? "border-primary/40 shadow-sm ring-1 ring-primary/15" : "border-border/60 hover:border-primary/25 hover:bg-background",
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge variant={item.kind === "action" ? "secondary" : "outline"}>
                                  {item.kind === "action" ? "Backlog" : "Suggestion"}
                                </Badge>
                                {item.kind === "action" && item.status ? (
                                  <Badge variant="outline">{formatPerceptionStatusLabel(item.status)}</Badge>
                                ) : null}
                              </div>
                              <div className="mt-2 text-sm font-semibold text-foreground">{item.title}</div>
                              <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted-foreground">{item.issue}</p>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{formatPerceptionFixTypeLabel(item.type)}</Badge>
                            {item.models.slice(0, 2).map((model) => (
                              <ModelMiniBadge key={`${item.id}-${model}`} model={model} />
                            ))}
                            {item.models.length > 2 ? <Badge variant="outline">+{item.models.length - 2}</Badge> : null}
                          </div>

                          <div className="mt-4 flex items-center justify-between gap-3">
                            <div className="text-xs text-muted-foreground">
                              {item.kind === "action" && item.updatedAt
                                ? `Mis à jour ${formatDateTime(item.updatedAt)}`
                                : "Pas encore ajoutée au backlog"}
                            </div>
                            {suggestionError ? (
                              <Button
                                type="button"
                                size="sm"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  createMutation.mutate(suggestionError);
                                }}
                                disabled={isSaving}
                              >
                                {isSaving ? "Ajout..." : "Ajouter"}
                              </Button>
                            ) : (
                              <span className="text-xs font-medium text-primary">Voir le détail</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="mt-4 border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            <DashboardSectionTitle>Détail de l’élément sélectionné</DashboardSectionTitle>
          </CardTitle>
          <CardDescription>
            Cliquez sur une carte du kanban pour relire le problème exact et le contenu recommandé.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selectedItem ? (
            <div className="space-y-4">
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={selectedItem.priority === "high" ? "destructive" : "secondary"}>
                        {formatPerceptionPriorityLabel(selectedItem.priority)}
                      </Badge>
                      <Badge variant="outline">{formatPerceptionFixTypeLabel(selectedItem.type)}</Badge>
                      <Badge variant="outline">
                        {selectedItem.kind === "action" ? formatPerceptionStatusLabel(selectedItem.status ?? "draft") : "Suggestion"}
                      </Badge>
                    </div>
                    <div className="mt-3 text-lg font-semibold text-foreground">{selectedItem.title}</div>
                  </div>
                  <div className="text-right text-xs text-muted-foreground">
                    {selectedItem.updatedAt ? `Mis à jour ${formatDateTime(selectedItem.updatedAt)}` : "Suggestion non créée"}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                <DetailBlock title="Problème détecté" icon={AlertCircle} content={selectedItem.issue} />
                <DetailBlock
                  title="Impact attendu"
                  icon={Target}
                  content={selectedItem.impact || "Impact non précisé pour cet élément."}
                />
              </div>

              <Card className="border-border/60">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-foreground">Contenu recommandé</CardTitle>
                  <CardDescription>
                    Brouillon à reprendre dans votre site, votre FAQ, vos comparatifs ou vos pages de preuve.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-2xl border border-border/60 bg-muted/15 p-4 text-sm leading-7 whitespace-pre-wrap break-words">
                    {selectedItem.generatedContent}
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-foreground">Modèles concernés</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selectedItem.models.length === 0 ? (
                      <div className="text-sm text-muted-foreground">Aucun modèle renseigné.</div>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selectedItem.models.map((model) => (
                          <ModelMiniBadge key={`${selectedItem.id}-detail-${model}`} model={model} />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="border-border/60">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-semibold text-foreground">Contexte</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>Type</span>
                      <span className="font-medium text-foreground">{selectedItem.kind === "action" ? "Backlog" : "Suggestion"}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Prompts concernés</span>
                      <span className="font-medium text-foreground">{selectedItem.promptsCount}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Créée le</span>
                      <span className="font-medium text-foreground">
                        {selectedItem.createdAt ? formatDate(selectedItem.createdAt) : "Non créée"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-14 text-sm text-muted-foreground">
              Sélectionnez une carte dans le kanban pour afficher le détail.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

const KANBAN_COLUMN_ORDER: OptimizePriority[] = ["high", "medium", "low"];

function getPriorityColumnTitle(priority: OptimizePriority): string {
  if (priority === "high") return "Urgent";
  if (priority === "medium") return "À planifier";
  return "À surveiller";
}

function getPriorityColumnDescription(priority: OptimizePriority): string {
  if (priority === "high") return "À traiter en premier pour corriger les écarts les plus visibles.";
  if (priority === "medium") return "À cadrer rapidement pour renforcer la compréhension de la marque.";
  return "Pistes utiles, mais moins pressantes à court terme.";
}

function buildBoardItems(
  actions: OptimizeActionRecord[],
  suggestions: PerceptionError[],
): OptimizeBoardItem[] {
  const actionItems = actions.map<OptimizeBoardItem>((action) => ({
    id: `action:${action.id}`,
    kind: "action",
    priority: action.priority,
    type: action.type,
    title: action.title,
    issue: action.issue,
    impact: action.impact,
    generatedContent: action.generatedContent,
    status: action.status,
    models: action.metadata.aiModels,
    promptsCount: action.metadata.promptsCount,
    createdAt: action.createdAt || null,
    updatedAt: action.updatedAt || null,
    sourceErrorId: action.sourceErrorId || null,
  }));

  const suggestionItems = suggestions.map<OptimizeBoardItem>((error) => ({
    id: `suggestion:${error.id}`,
    kind: "suggestion",
    priority: error.optimizePriority,
    type: error.fixType,
    title: error.title,
    issue: error.issue,
    impact: error.impact,
    generatedContent: error.generatedContent,
    status: null,
    models: error.detectedInModels,
    promptsCount: 0,
    createdAt: null,
    updatedAt: null,
    sourceErrorId: error.id,
  }));

  return [...actionItems, ...suggestionItems].sort(compareBoardItems);
}

function buildKanbanColumns(items: OptimizeBoardItem[]): Record<OptimizePriority, OptimizeBoardItem[]> {
  return {
    high: items.filter((item) => item.priority === "high"),
    medium: items.filter((item) => item.priority === "medium"),
    low: items.filter((item) => item.priority === "low"),
  };
}

function ModelMiniBadge({ model }: { model: string }) {
  const icon = toSafeImageAssetPath(getModelIconForName(model));

  return (
    <Badge variant="outline" className="gap-1.5 font-normal">
      <img src={icon} alt="" className="h-3.5 w-3.5 rounded-full object-contain" />
      <span className="max-w-[140px] truncate">{model}</span>
    </Badge>
  );
}

function DetailBlock({
  title,
  content,
  icon: Icon,
}: {
  title: string;
  content: string;
  icon: typeof AlertCircle;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm leading-7 text-muted-foreground">{content}</p>
      </CardContent>
    </Card>
  );
}

function OptimizeActionsEmptyState({
  hasSuggestions,
  routeSearch,
}: {
  hasSuggestions: boolean;
  routeSearch: string;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border/70 bg-muted/15 px-4 py-10 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">Aucune action ne correspond aux filtres actuels.</div>
      <p className="mt-2 leading-6">
        {hasSuggestions
          ? "Vous pouvez commencer par ajouter une suggestion détectée dans le kanban."
          : "Retournez sur la page Perception pour générer vos premières actions à partir des erreurs détectées."}
      </p>
      {!hasSuggestions ? (
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link to={{ pathname: "/perception", search: routeSearch }}>Aller à la perception</Link>
        </Button>
      ) : null}
    </div>
  );
}

function OptimizeActionsProjectRequiredState() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title="Actions d'optimisation"
        baseline="Sélectionnez d’abord un projet pour charger ses actions d’optimisation et ses suggestions détectées."
      />

      <div className="mt-4 rounded-2xl border border-dashed border-border/70 bg-muted/15 px-6 py-12 text-sm text-muted-foreground">
        Aucun projet n’est sélectionné. Ajoutez `?projectId=...` dans l’URL ou choisissez un projet depuis
        l’application pour afficher le backlog d’optimisation.
      </div>
    </div>
  );
}

function OptimizeActionsLoadingState() {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto p-2 md:p-4">
      <PageHeader
        title="Actions d'optimisation"
        baseline="Chargement du backlog d’optimisation et des dernières suggestions détectées."
      />

      <Card className="mt-4 border-border/60 rounded-tr-none">
        <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-10 w-full md:w-[340px]" />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        {Array.from({ length: 3 }).map((_, columnIndex) => (
          <Card key={columnIndex} className="border-border/60">
            <CardHeader className="pb-3">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-52" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 3 }).map((__, cardIndex) => (
                <Skeleton key={cardIndex} className="h-40 w-full rounded-2xl" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-4">
        <Card className="border-border/60">
          <CardContent className="space-y-4 p-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-28 w-full rounded-2xl" />
            <Skeleton className="h-48 w-full rounded-2xl" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function readProjectIdFromSearch(routeSearch: string): string | null {
  const normalized = routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch;
  const params = new URLSearchParams(normalized);
  const value = params.get("projectId") || params.get("project_id") || params.get("project") || "";
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function loadOptimizeActions(
  apiBaseURL: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<OptimizeActionRecord[]> {
  const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.optimizeActions(encodeURIComponent(projectId)), {
    method: "GET",
    signal,
  });

  if (!result.ok) {
    throw new Error(result.error);
  }

  return asArray(unwrapResult(result.data))
    .map(parseOptimizeAction)
    .sort(compareOptimizeActions);
}

async function createOptimizeAction(
  apiBaseURL: string,
  projectId: string,
  error: PerceptionError,
): Promise<void> {
  const result = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.analysis.optimizeActions(encodeURIComponent(projectId)), {
    method: "POST",
    body: JSON.stringify({
      priority: error.optimizePriority,
      type: error.fixType,
      title: error.title,
      issue: error.issue,
      impact: error.impact,
      generatedContent: error.generatedContent,
      status: "draft",
      sourceErrorId: error.id,
      metadata: {
        detectedInModels: error.detectedInModels,
        aiModels: error.detectedInModels,
        promptsCount: 0,
      },
    }),
  });

  if (!result.ok) {
    throw new Error(result.error);
  }
}

function unwrapResult(value: unknown): unknown {
  const object = asObject(value);
  if (object.success === true && "data" in object) {
    return object.data;
  }
  if ("data" in object) {
    return object.data;
  }
  return value;
}

function parseOptimizeAction(value: unknown): OptimizeActionRecord {
  const object = asObject(value);
  const metadata = asObject(object.metadata);

  return {
    id: asString(object.id),
    priority: normalizePriority(asString(object.priority)),
    type: asString(object.type),
    title: asString(object.title),
    issue: asString(object.issue),
    impact: asString(object.impact),
    generatedContent: asString(object.generatedContent),
    status: asString(object.status) || "draft",
    sourceErrorId: asString(object.sourceErrorId),
    metadata: {
      aiModels: uniqueStrings([
        ...asStringArray(metadata.aiModels),
        ...asStringArray(metadata.detectedInModels),
      ]),
      promptsCount: asNumber(metadata.promptsCount),
    },
    createdAt: asString(object.createdAt),
    updatedAt: asString(object.updatedAt),
  };
}

function normalizePriority(value: string): OptimizePriority {
  if (value === "high" || value === "low") return value;
  return "medium";
}

function compareOptimizeActions(a: OptimizeActionRecord, b: OptimizeActionRecord): number {
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;
  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function compareBoardItems(a: OptimizeBoardItem, b: OptimizeBoardItem): number {
  const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
  if (priorityDelta !== 0) return priorityDelta;

  if (a.kind !== b.kind) {
    return a.kind === "action" ? -1 : 1;
  }

  return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
}

function priorityRank(priority: OptimizePriority): number {
  if (priority === "high") return 0;
  if (priority === "medium") return 1;
  return 2;
}

function buildOptimizeSummary(actions: OptimizeActionRecord[], suggestions: PerceptionError[]) {
  return {
    totalActions: actions.length,
    pendingSuggestions: suggestions.length,
  };
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date inconnue";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(asString).filter(Boolean) : [];
}

function asNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
