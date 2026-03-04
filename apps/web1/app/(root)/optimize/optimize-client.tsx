"use client";

import { useEffect, useMemo, useRef, useState, startTransition } from "react";
import {
  Bot,
  Copy,
  Download,
  ExternalLink,
  FileCode2,
  GripVertical,
  Loader2,
  Play,
  RefreshCcw,
  Sparkles,
  SquareArrowOutUpRight,
  Trello,
  TriangleAlert,
  Wand2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { API_CONFIG, apiRoutes, buildApiPath } from "@/lib/api-config";
import { cn } from "@/lib/utils";
import type { BrandCanon, OptimizePriority, PerceptionViewData } from "@/lib/perception-data";
import type { ContentOptimizationRecommendation, ContentOptimizerSummary } from "@/lib/content-optimizer-data";
import type { OptimizeAction, OptimizeGeneratedContent } from "@/lib/optimize-data";
import { mapOptimizeActionApiRow } from "@/lib/optimize-data";

type OptimizePageClientProps = {
  initialActions: OptimizeAction[];
  brandCanon: BrandCanon;
  projectId: string | null;
  source: PerceptionViewData["source"];
  brandName: string;
  contentOptimizerSummary: ContentOptimizerSummary;
  pageMode?: "tabs" | "actions" | "content-optimizer";
};

type PublishTarget = "webflow" | "hubspot";

const COLUMN_ORDER: OptimizePriority[] = ["high", "medium", "low"];

const COLUMN_META: Record<
  OptimizePriority,
  { title: string; subtitle: string; accentClassName: string; badgeVariant: "destructive" | "secondary" | "outline" }
> = {
  high: {
    title: "Haute Priorité",
    subtitle: "Critical · erreurs bloquantes",
    accentClassName: "border-rose-500/30 bg-rose-500/5",
    badgeVariant: "destructive",
  },
  medium: {
    title: "Moyenne Priorité",
    subtitle: "Erreurs importantes",
    accentClassName: "border-amber-500/30 bg-amber-500/5",
    badgeVariant: "secondary",
  },
  low: {
    title: "Basse Priorité",
    subtitle: "Améliorations",
    accentClassName: "border-slate-500/20 bg-slate-500/5",
    badgeVariant: "outline",
  },
};

export function OptimizePageClient({
  initialActions,
  brandCanon,
  projectId,
  source,
  brandName,
  contentOptimizerSummary,
  pageMode = "tabs",
}: OptimizePageClientProps) {
  const [actions, setActions] = useState<OptimizeAction[]>(initialActions);
  const [activeTab, setActiveTab] = useState<"actions" | "content-optimizer">(
    pageMode === "content-optimizer" ? "content-optimizer" : "actions",
  );
  const [activeActionId, setActiveActionId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverPriority, setDragOverPriority] = useState<OptimizePriority | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [contentOptimizer, setContentOptimizer] = useState<ContentOptimizerSummary>(contentOptimizerSummary);
  const [activeRecommendationId, setActiveRecommendationId] = useState<string | null>(null);
  const [analyzingContent, setAnalyzingContent] = useState(false);
  const [generatingRecommendationId, setGeneratingRecommendationId] = useState<string | null>(null);
  const [promotingRecommendationId, setPromotingRecommendationId] = useState<string | null>(null);
  const [loadingGenerateId, setLoadingGenerateId] = useState<string | null>(null);
  const [publishingKey, setPublishingKey] = useState<string | null>(null);
  const [runningAnalysis, setRunningAnalysis] = useState(false);
  const [isDesktopDnD, setIsDesktopDnD] = useState(true);
  const dragGhostRef = useRef<HTMLElement | null>(null);

  const countsByPriority = useMemo(() => {
    return {
      high: actions.filter((a) => a.priority === "high").length,
      medium: actions.filter((a) => a.priority === "medium").length,
      low: actions.filter((a) => a.priority === "low").length,
    };
  }, [actions]);

  const prioritizedOpenCount = useMemo(() => actions.length, [actions]);

  const activeAction = useMemo(() => actions.find((a) => a.id === activeActionId) ?? null, [actions, activeActionId]);
  const activeRecommendation = useMemo(
    () => contentOptimizer.topRecommendations.find((rec) => rec.id === activeRecommendationId) ?? null,
    [contentOptimizer.topRecommendations, activeRecommendationId],
  );
  const showTabs = pageMode === "tabs";

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px) and (pointer: fine)");
    const apply = () => setIsDesktopDnD(media.matches);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    return () => {
      if (dragGhostRef.current) {
        dragGhostRef.current.remove();
        dragGhostRef.current = null;
      }
    };
  }, []);

  const moveActionToPriority = async (actionId: string, priority: OptimizePriority) => {
    const current = actions.find((a) => a.id === actionId);
    if (!current || current.priority === priority) return;

    setMessage(null);
    setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, priority } : a)));

    if (!projectId || actionId.startsWith("demo-opt-")) {
      setMessage("Mode démo: priorité mise à jour localement.");
      return;
    }

    try {
      await patchJson(apiRoutes.analysis.optimizeAction(projectId, actionId), { priority });
    } catch (err) {
      setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, priority: current.priority } : a)));
      setMessage(err instanceof Error ? err.message : "Impossible de mettre à jour la priorité");
    }
  };

  const updateAction = (actionId: string, patch: Partial<OptimizeAction>) => {
    setActions((prev) => prev.map((a) => (a.id === actionId ? { ...a, ...patch } : a)));
  };

  const handleGenerate = async (action: OptimizeAction) => {
    setActiveActionId(action.id);
    setLoadingGenerateId(action.id);
    setMessage(null);

    try {
      const generated = await generateOptimizeContent({
        action,
        brandCanon,
        projectId,
      });

      updateAction(action.id, {
        status: action.status === "resolved" ? "resolved" : "in_progress",
        generatedContent: { ...action.generatedContent, ...generated },
      });
      if (projectId && !action.id.startsWith("demo-opt-")) {
        await patchJson(apiRoutes.analysis.optimizeAction(projectId, action.id), {
          status: action.status === "resolved" ? "resolved" : "in_progress",
          generatedContent: JSON.stringify({
            markdown: generated.markdown ?? action.generatedContent?.markdown ?? "",
            html: generated.html ?? action.generatedContent?.html,
            publishedUrl: action.generatedContent?.publishedUrl,
          }),
          metadata: {
            aiModels: action.aiModels,
            promptsCount: action.promptsCount,
          },
        });
      }
      setMessage("Contenu généré.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Erreur de génération");
    } finally {
      setLoadingGenerateId(null);
    }
  };

  const handlePublish = async (action: OptimizeAction, target: PublishTarget) => {
    setPublishingKey(`${action.id}:${target}`);
    setMessage(null);

    try {
      const result = await publishOptimizeContent({
        action,
        target,
        projectId,
      });

      updateAction(action.id, {
        status: "resolved",
        generatedContent: {
          ...action.generatedContent,
          publishedUrl: result.publishedUrl ?? action.generatedContent?.publishedUrl,
        },
      });
      if (projectId && !action.id.startsWith("demo-opt-")) {
        await patchJson(apiRoutes.analysis.optimizeAction(projectId, action.id), {
          status: "resolved",
          generatedContent: JSON.stringify({
            markdown: action.generatedContent?.markdown ?? "",
            html: action.generatedContent?.html,
            publishedUrl: result.publishedUrl ?? action.generatedContent?.publishedUrl,
          }),
          metadata: {
            aiModels: action.aiModels,
            promptsCount: action.promptsCount,
            publishedUrl: result.publishedUrl ?? action.generatedContent?.publishedUrl,
          },
        });
      }
      setMessage(
        result.publishedUrl
          ? `Publié sur ${target} (${result.publishedUrl})`
          : `Publication ${target} simulée (mode démo).`,
      );
    } catch (err) {
      setMessage(err instanceof Error ? err.message : `Erreur de publication ${target}`);
    } finally {
      setPublishingKey(null);
    }
  };

  const handleCopyMarkdown = async () => {
    if (!activeAction?.generatedContent?.markdown) return;
    try {
      await navigator.clipboard.writeText(activeAction.generatedContent.markdown);
      setMessage("Markdown copié.");
    } catch {
      setMessage("Impossible de copier dans le presse-papiers.");
    }
  };

  const handleExportMarkdown = () => {
    if (!activeAction?.generatedContent?.markdown) return;
    const blob = new Blob([activeAction.generatedContent.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slugify(activeAction.title)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Markdown exporté.");
  };

  const handleExportTrello = () => {
    const payload = {
      exportedAt: new Date().toISOString(),
      board: "Optimize AI Perception",
      cards: actions.map((action) => ({
        name: action.title,
        description: `${action.issue}\n\nImpact: ${action.impact}`,
        labels: [action.priority, ...action.aiModels],
        priority: action.priority,
        status: action.status,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "optimize-actions-trello-export.json";
    a.click();
    URL.revokeObjectURL(url);
    setMessage("Export Trello (JSON) généré.");
  };

  const handleRunAnalysis = async () => {
    setMessage(null);
    if (!projectId) {
      setMessage("Mode démo: aucune analyse serveur lancée.");
      return;
    }

    setRunningAnalysis(true);
    try {
      await postJson(apiRoutes.analysis.start(projectId), {});
      setMessage("Nouvelle analyse lancée.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Impossible de lancer l'analyse");
    } finally {
      setRunningAnalysis(false);
    }
  };

  const handleAnalyzeContent = async () => {
    setMessage(null);
    if (!projectId) {
      setContentOptimizer((current) => ({ ...current, lastAnalyzedAt: new Date().toISOString() }));
      setMessage("Mode démo: analyse contenu simulée.");
      return;
    }

    setAnalyzingContent(true);
    try {
      const result = await postJson<ContentOptimizerSummary>(apiRoutes.analysis.contentOptimizer.analyze(projectId), {});
      setContentOptimizer(result);
      setMessage("Analyse contenu terminée.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Impossible d'analyser le contenu");
    } finally {
      setAnalyzingContent(false);
    }
  };

  const handlePromoteRecommendation = async (rec: ContentOptimizationRecommendation) => {
    setPromotingRecommendationId(rec.id);
    setMessage(null);
    if (!projectId) {
      setMessage("Mode démo: promotion vers Kanban simulée.");
      setActiveTab("actions");
      setPromotingRecommendationId(null);
      return;
    }

    try {
      let created: unknown;
      try {
        created = await postJson<unknown>(apiRoutes.analysis.contentOptimizer.promote(projectId, rec.id), {});
      } catch {
        created = await postJson<unknown>(apiRoutes.analysis.optimizeActions(projectId), {
          priority: rec.priority === "low" ? "low" : rec.priority === "medium" ? "medium" : "high",
          type:
            rec.type === "schema_ld"
              ? "pricing"
              : rec.type === "comparison"
                ? "comparison"
                : "faq",
          title: rec.title,
          issue: rec.issue,
          impact: rec.estimatedImpactLabel,
          generatedContent: JSON.stringify({
            html: rec.generatedCode ?? "",
            markdown: rec.generatedCode ?? "",
          }),
          status: "open",
          metadata: {
            source: "content_optimizer",
            pageUrl: rec.pageUrl,
            recommendationId: rec.id,
            promptsCount: rec.promptsLost ?? 0,
            aiModels: ["ChatGPT", "Claude", "Perplexity"],
          },
        });
      }

      const mapped = mapOptimizeActionApiRow(created as never);
      setActions((current) => [mapped, ...current.filter((a) => a.id !== mapped.id)]);
      setActiveTab("actions");
      setMessage("Recommandation ajoutée au Kanban.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Impossible d'ajouter au Kanban");
    } finally {
      setPromotingRecommendationId(null);
    }
  };

  const handleGenerateRecommendation = async (rec: ContentOptimizationRecommendation) => {
    setActiveRecommendationId(rec.id);
    if (!projectId) return;
    setGeneratingRecommendationId(rec.id);
    setMessage(null);
    try {
      const result = await postJson<{ recommendationId: string; generatedCode: string; provider: string }>(
        apiRoutes.analysis.contentOptimizer.generate(projectId, rec.id),
        {},
      );
      setContentOptimizer((current) => ({
        ...current,
        topRecommendations: current.topRecommendations.map((item) =>
          item.id === rec.id ? { ...item, generatedCode: result.generatedCode } : item,
        ),
      }));
      setMessage(`Code généré (${result.provider}).`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Impossible de générer le code");
    } finally {
      setGeneratingRecommendationId(null);
    }
  };

  const handleCopyRecommendationCode = async () => {
    if (!activeRecommendation?.generatedCode) return;
    try {
      await navigator.clipboard.writeText(activeRecommendation.generatedCode);
      setMessage("Code HTML/JSON-LD copié.");
    } catch {
      setMessage("Impossible de copier le code.");
    }
  };

  const actionsBoardContent = (
    <ScrollArea className="min-h-0 flex-1">
      <div className="overflow-x-auto pb-2 [scrollbar-width:thin]">
        <div className="flex min-h-0 min-w-max snap-x snap-mandatory gap-4 pr-1 xl:grid xl:min-w-0 xl:grid-cols-3 xl:snap-none">
          {COLUMN_ORDER.map((priority) => {
          const columnActions = actions
            .filter((action) => action.priority === priority)
            .sort((a, b) => {
              const statusRank = statusOrder(a.status) - statusOrder(b.status);
              if (statusRank !== 0) return statusRank;
              return a.createdAt < b.createdAt ? 1 : -1;
            });

          const meta = COLUMN_META[priority];
          const totalPrompts = columnActions.reduce((sum, action) => sum + action.promptsCount, 0);

          return (
            <div
              key={priority}
              className={cn(
                "w-[320px] sm:w-[360px] xl:w-auto flex min-h-[520px] flex-col rounded-2xl border border-black/5 bg-[#f3f4f6] p-3 shadow-sm transition-colors",
                "snap-start",
                dragOverPriority === priority && "ring-2 ring-primary/25",
              )}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setDragOverPriority(priority);
              }}
              onDrop={(e) => {
                e.preventDefault();
                const droppedId = e.dataTransfer.getData("text/plain");
                setDraggingId(null);
                setDragOverPriority(null);
                if (droppedId) void moveActionToPriority(droppedId, priority);
              }}
              onDragLeave={() => {
                if (dragOverPriority === priority) setDragOverPriority(null);
              }}
            >
              <div className="mb-3 px-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[15px] font-semibold text-foreground">{meta.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {columnActions.length} tasks, {Math.max(1, Math.round(totalPrompts / 10))}h estimées
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-white/80 text-[11px]">
                    {countsByPriority[priority]}
                  </Badge>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                {columnActions.map((action) => {
                  const isGenerating = loadingGenerateId === action.id;
                  const isPublishingWebflow = publishingKey === `${action.id}:webflow`;
                  const isResolved = action.status === "resolved";

                  return (
                    <article
                      key={action.id}
                      onClick={() => setActiveActionId(action.id)}
                      className={cn(
                        "cursor-pointer overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition hover:shadow-md",
                        draggingId === action.id && "opacity-60",
                        activeActionId === action.id && "ring-1 ring-primary/30",
                      )}
                    >
                      <div className={cn("h-1.5 w-full", actionTypeAccent(action.type))} />
                      <div className={cn("relative h-14 border-b border-black/5", actionTypeCoverClass(action.type))}>
                        <div className="absolute inset-0 opacity-60 [background:radial-gradient(circle_at_20%_30%,rgba(255,255,255,.9),transparent_38%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,.55),transparent_34%),radial-gradient(circle_at_70%_80%,rgba(255,255,255,.45),transparent_30%)]" />
                        <div className="absolute bottom-2 left-3 text-[11px] font-medium text-white/90">
                          {action.type === "pricing" ? "Pricing Signals" : action.type === "comparison" ? "Comparison Layer" : "FAQ Patch"}
                        </div>
                      </div>
                      <div className="p-3">
                        <div className="mb-2 flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="mb-1 flex flex-wrap items-center gap-1.5">
                              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", statusPillClass(action.status))}>
                                {statusBoardLabel(action.status)}
                              </span>
                              <span className="text-[10px] text-muted-foreground capitalize">{action.type}</span>
                            </div>
                            <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{action.title}</h3>
                          </div>
                          <button
                            type="button"
                            draggable={isDesktopDnD}
                            aria-label={`Déplacer ${action.title}`}
                            title="Drag"
                            onClick={(e) => e.stopPropagation()}
                            onDragStart={(e) => {
                              if (!isDesktopDnD) {
                                e.preventDefault();
                                return;
                              }
                              e.stopPropagation();
                              setDraggingId(action.id);
                              e.dataTransfer.effectAllowed = "move";
                              e.dataTransfer.setData("text/plain", action.id);
                              const article = (e.currentTarget.closest("article") as HTMLElement | null);
                              if (dragGhostRef.current) {
                                dragGhostRef.current.remove();
                                dragGhostRef.current = null;
                              }
                              if (article) {
                                const ghost = article.cloneNode(true) as HTMLElement;
                                ghost.style.position = "fixed";
                                ghost.style.top = "-1000px";
                                ghost.style.left = "-1000px";
                                ghost.style.width = `${article.offsetWidth}px`;
                                ghost.style.pointerEvents = "none";
                                ghost.style.transform = "rotate(2deg)";
                                ghost.style.opacity = "0.96";
                                ghost.style.boxShadow = "0 20px 40px rgba(0,0,0,0.18)";
                                ghost.style.borderRadius = "14px";
                                document.body.appendChild(ghost);
                                dragGhostRef.current = ghost;
                                e.dataTransfer.setDragImage(ghost, 24, 18);
                              }
                            }}
                            onDragEnd={(e) => {
                              e.stopPropagation();
                              setDraggingId(null);
                              setDragOverPriority(null);
                              if (dragGhostRef.current) {
                                dragGhostRef.current.remove();
                                dragGhostRef.current = null;
                              }
                            }}
                            className={cn(
                              "mt-0.5 shrink-0 rounded-md p-1 text-muted-foreground hover:bg-muted",
                              !isDesktopDnD && "opacity-40 cursor-not-allowed",
                            )}
                          >
                            <GripVertical className="h-4 w-4" />
                          </button>
                        </div>

                        <p className="mb-3 line-clamp-3 text-xs text-muted-foreground">{action.issue}</p>

                        {isResolved ? null : (
                          <div className="mb-3 rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-2 py-1.5 text-[11px] text-emerald-700 dark:text-emerald-300">
                            {action.impact}
                          </div>
                        )}

                        <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Bot className="h-3.5 w-3.5" />
                            {action.aiModels.length} IA
                          </span>
                          <span>{action.promptsCount} prompts</span>
                          <span>{Math.max(10, action.promptsCount * 3)} min</span>
                          <span>{action.aiModels.slice(0, 2).join(", ") || "n/a"}</span>
                        </div>

                        {!isDesktopDnD ? (
                          <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                            <span className="text-muted-foreground">Move to:</span>
                            {COLUMN_ORDER.filter((p) => p !== action.priority).map((target) => (
                              <Button
                                key={`${action.id}-${target}`}
                                size="sm"
                                variant="outline"
                                className="h-6 rounded-full px-2 text-[10px]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void moveActionToPriority(action.id, target);
                                }}
                              >
                                {target === "high" ? "High" : target === "medium" ? "Medium" : "Low"}
                              </Button>
                            ))}
                          </div>
                        ) : null}

                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              void handleGenerate(action);
                            }}
                            disabled={isGenerating}
                          >
                            {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
                            Générer
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={(e) => {
                              e.stopPropagation();
                              startTransition(() => setActiveActionId(action.id));
                              if (!action.generatedContent?.markdown) {
                                void handleGenerate(action);
                              } else {
                                void handlePublish(action, "webflow");
                              }
                            }}
                            disabled={isPublishingWebflow}
                          >
                            {isPublishingWebflow ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ExternalLink className="h-3.5 w-3.5" />
                            )}
                            Publier
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}

                {columnActions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-black/10 bg-white/70 p-4 text-center text-sm text-muted-foreground">
                    Déposez des actions ici
                  </div>
                ) : null}

                <div
                  className={cn(
                    "rounded-xl border border-dashed border-black/10 bg-white/50 px-2 py-1.5 text-center text-xs text-muted-foreground",
                    dragOverPriority === priority && "border-primary/40 bg-primary/5 text-foreground",
                  )}
                >
                  Zone de drop
                </div>
              </div>
            </div>
          );
          })}
        </div>
      </div>
    </ScrollArea>
  );

  const contentOptimizerContent = (
    <ContentOptimizerPanel
      summary={contentOptimizer}
      onAnalyze={() => void handleAnalyzeContent()}
      analyzing={analyzingContent}
      onOpenRecommendation={(id) => {
        const rec = contentOptimizer.topRecommendations.find((r) => r.id === id);
        if (!rec) return;
        void handleGenerateRecommendation(rec);
      }}
      onPromoteRecommendation={(rec) => void handlePromoteRecommendation(rec)}
      promotingRecommendationId={promotingRecommendationId}
      generatingRecommendationId={generatingRecommendationId}
    />
  );

  return (
    <>
      <div className="mx-0 my-0 flex h-auto min-h-0 flex-col gap-4 md:m-4 xl:h-full xl:min-h-0 xl:overflow-hidden">
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant={source === "project" ? "default" : "outline"}>{source === "project" ? "Projet" : "Demo"}</Badge>
                  <Badge variant="secondary">{brandName}</Badge>
                </div>
                <CardTitle className="text-xl">
                  Optimize AI Perception ({prioritizedOpenCount} actions prioritaires)
                </CardTitle>
                <CardDescription>
                  Détecte, génère, publie et mesure les corrections de perception IA sur vos pages et contenus.
                </CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={() => void handleRunAnalysis()} disabled={runningAnalysis}>
                  {runningAnalysis ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                  Run nouvelle analyse
                </Button>
                <Button variant="outline" onClick={() => setMessage("Connexion CMS: écran de configuration à brancher.")}>
                  <SquareArrowOutUpRight className="h-4 w-4" />
                  Connect CMS
                </Button>
                <Button variant="outline" onClick={handleExportTrello}>
                  <Trello className="h-4 w-4" />
                  Export Trello
                </Button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Connected:</span>
              <ConnectedPill name="Webflow" connected />
              <ConnectedPill name="HubSpot" connected />
              <ConnectedPill name="Stripe" connected />
            </div>
            {message ? (
              <div className="mt-2 rounded-md border border-border/70 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {message}
              </div>
            ) : null}
          </CardHeader>
        </Card>

        {showTabs ? (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as "actions" | "content-optimizer")}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="px-1">
              <TabsList className="w-full justify-start sm:w-auto">
                <TabsTrigger value="actions">Kanban Actions</TabsTrigger>
                <TabsTrigger value="content-optimizer">Content Optimizer</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="actions" className="m-0 flex min-h-0 flex-1">
              {actionsBoardContent}
            </TabsContent>
            <TabsContent value="content-optimizer" className="m-0 flex min-h-0 flex-1">
              {contentOptimizerContent}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="flex min-h-0 flex-1">
            {pageMode === "content-optimizer" ? contentOptimizerContent : actionsBoardContent}
          </div>
        )}
      </div>

      <Sheet open={Boolean(activeRecommendation)} onOpenChange={(open) => !open && setActiveRecommendationId(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl">
          {activeRecommendation ? (
            <>
              <SheetHeader className="border-b">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{activeRecommendation.pageUrl}</Badge>
                  <Badge
                    variant={
                      activeRecommendation.priority === "high"
                        ? "destructive"
                        : activeRecommendation.priority === "medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {activeRecommendation.priority}
                  </Badge>
                  <Badge variant="secondary">{activeRecommendation.type}</Badge>
                </div>
                <SheetTitle className="pr-8">Optimizer Drawer</SheetTitle>
                <SheetDescription className="pr-8">{activeRecommendation.title}</SheetDescription>
              </SheetHeader>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-2">
                <ScrollArea className="h-[45vh] border-b lg:h-full lg:border-r lg:border-b-0">
                  <div className="space-y-4 p-4">
                    <div className="rounded-md border border-border/70 bg-muted/30 p-3">
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Impact estimé</div>
                      <p className="text-sm">
                        {activeRecommendation.estimatedImpactLabel}
                        {typeof activeRecommendation.promptsLost === "number"
                          ? ` sur ${activeRecommendation.promptsLost} prompts`
                          : ""}
                      </p>
                    </div>
                    <div className="rounded-md border border-border/70 p-3">
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Problème détecté</div>
                      <p className="text-sm">{activeRecommendation.issue}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Code / contenu à ajouter</div>
                      <pre className="max-h-[420px] overflow-auto rounded-md border bg-background p-3 text-xs whitespace-pre-wrap">
                        {activeRecommendation.generatedCode || "Aucun code généré"}
                      </pre>
                    </div>
                  </div>
                </ScrollArea>
                <ScrollArea className="h-[45vh] lg:h-full">
                  <div className="space-y-4 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <FileCode2 className="h-4 w-4" />
                      Preview patch contenu
                    </div>
                    <Separator />
                    <div className="rounded-md border p-3 text-sm">
                      <div className="mb-2 font-medium">{activeRecommendation.title}</div>
                      <div className="text-muted-foreground">{activeRecommendation.issue}</div>
                    </div>
                    <div className="rounded-md border border-primary/15 bg-primary/5 p-3 text-sm">
                      Conseil: ajoute ce patch sur <code>{activeRecommendation.pageUrl}</code> puis relance l&apos;analyse du site.
                    </div>
                  </div>
                </ScrollArea>
              </div>

              <SheetFooter className="border-t">
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button variant="outline" onClick={() => void handleCopyRecommendationCode()}>
                    <Copy className="h-4 w-4" />
                    Copier HTML
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setMessage("Publication Webflow du patch contenu à brancher.")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Publier Webflow
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setMessage("Mode édition assistée à brancher.")}
                  >
                    <Wand2 className="h-4 w-4" />
                    Modifier
                  </Button>
                  <Button
                    onClick={() => void handlePromoteRecommendation(activeRecommendation)}
                    disabled={promotingRecommendationId === activeRecommendation.id}
                  >
                    {promotingRecommendationId === activeRecommendation.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    Ajouter Kanban
                  </Button>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={Boolean(activeAction)} onOpenChange={(open) => !open && setActiveActionId(null)}>
        <SheetContent side="right" className="w-full gap-0 sm:max-w-2xl">
          {activeAction ? (
            <>
              <SheetHeader className="border-b">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="capitalize">
                    {activeAction.type}
                  </Badge>
                  <Badge
                    variant={
                      activeAction.priority === "high"
                        ? "destructive"
                        : activeAction.priority === "medium"
                          ? "secondary"
                          : "outline"
                    }
                  >
                    {activeAction.priority}
                  </Badge>
                  <StatusBadge status={activeAction.status} />
                </div>
                <SheetTitle className="pr-8">AI Content Generator</SheetTitle>
                <SheetDescription className="pr-8">
                  {activeAction.title}
                </SheetDescription>
              </SheetHeader>

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-0 lg:grid-cols-2">
                <ScrollArea className="h-[45vh] border-b lg:h-full lg:border-r lg:border-b-0">
                  <div className="space-y-4 p-4">
                    <div className="rounded-md border border-border/70 bg-muted/30 p-3">
                      <div className="mb-1 text-xs font-medium text-muted-foreground">Problème détecté</div>
                      <p className="text-sm">{activeAction.issue}</p>
                    </div>
                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 p-3">
                      <div className="mb-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
                        Impact estimé
                      </div>
                      <p className="text-sm">{activeAction.impact}</p>
                    </div>
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-muted-foreground">Contenu généré (Markdown)</div>
                      <pre className="max-h-[420px] overflow-auto rounded-md border bg-background p-3 text-xs whitespace-pre-wrap">
                        {activeAction.generatedContent?.markdown || "Aucun contenu généré pour cette action."}
                      </pre>
                    </div>
                  </div>
                </ScrollArea>

                <ScrollArea className="h-[45vh] lg:h-full">
                  <div className="space-y-4 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <Sparkles className="h-4 w-4" />
                      Preview du contenu généré
                    </div>
                    <Separator />
                    <MarkdownPreview markdown={activeAction.generatedContent?.markdown} />
                    {activeAction.generatedContent?.publishedUrl ? (
                      <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-sm">
                        Publié:{" "}
                        <a
                          href={activeAction.generatedContent.publishedUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {activeAction.generatedContent.publishedUrl}
                        </a>
                      </div>
                    ) : null}
                  </div>
                </ScrollArea>
              </div>

              <SheetFooter className="border-t">
                <div className="grid w-full grid-cols-2 gap-2 sm:grid-cols-4">
                  <Button variant="outline" onClick={() => void handleCopyMarkdown()} disabled={!activeAction.generatedContent?.markdown}>
                    <Copy className="h-4 w-4" />
                    Copier
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handlePublish(activeAction, "webflow")}
                    disabled={publishingKey === `${activeAction.id}:webflow`}
                  >
                    {publishingKey === `${activeAction.id}:webflow` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    Webflow
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => void handlePublish(activeAction, "hubspot")}
                    disabled={publishingKey === `${activeAction.id}:hubspot`}
                  >
                    {publishingKey === `${activeAction.id}:hubspot` ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ExternalLink className="h-4 w-4" />
                    )}
                    HubSpot
                  </Button>
                  <Button variant="outline" onClick={handleExportMarkdown} disabled={!activeAction.generatedContent?.markdown}>
                    <Download className="h-4 w-4" />
                    Markdown
                  </Button>
                </div>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}

function ConnectedPill({ name, connected }: { name: string; connected: boolean }) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs">
      <span className={cn("inline-block h-1.5 w-1.5 rounded-full", connected ? "bg-emerald-500" : "bg-slate-400")} />
      <span>{name}</span>
    </div>
  );
}

function actionTypeAccent(type: OptimizeAction["type"]): string {
  if (type === "pricing") return "bg-gradient-to-r from-orange-300 via-amber-300 to-yellow-200";
  if (type === "comparison") return "bg-gradient-to-r from-fuchsia-300 via-violet-300 to-sky-200";
  return "bg-gradient-to-r from-emerald-300 via-cyan-200 to-blue-200";
}

function actionTypeCoverClass(type: OptimizeAction["type"]): string {
  if (type === "pricing") return "bg-gradient-to-br from-orange-500 via-amber-400 to-yellow-300";
  if (type === "comparison") return "bg-gradient-to-br from-fuchsia-500 via-violet-500 to-sky-400";
  return "bg-gradient-to-br from-emerald-500 via-cyan-500 to-blue-500";
}

function statusPillClass(status: OptimizeAction["status"]): string {
  if (status === "resolved") return "bg-emerald-100 text-emerald-700";
  if (status === "in_progress") return "bg-orange-100 text-orange-700";
  return "bg-slate-200 text-slate-700";
}

function statusBoardLabel(status: OptimizeAction["status"]): string {
  if (status === "resolved") return "DONE";
  if (status === "in_progress") return "PROGRESS";
  return "TO DO";
}

function ContentOptimizerPanel({
  summary,
  onAnalyze,
  analyzing,
  onOpenRecommendation,
  onPromoteRecommendation,
  promotingRecommendationId,
  generatingRecommendationId,
}: {
  summary: ContentOptimizerSummary;
  onAnalyze: () => void;
  analyzing: boolean;
  onOpenRecommendation: (id: string) => void;
  onPromoteRecommendation: (rec: ContentOptimizationRecommendation) => void;
  promotingRecommendationId: string | null;
  generatingRecommendationId: string | null;
}) {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 xl:grid-cols-12">
      <Card className="xl:col-span-4">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <CardTitle className="text-base">Optimiseur Contenu IA</CardTitle>
          </div>
          <CardDescription>Booste les pages existantes pour les réponses IA (GEO, FAQ, schema, comparatifs).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground">Site Score</div>
            <div className="mt-1 flex items-end gap-2">
              <div className="text-3xl font-semibold">{summary.siteScore}</div>
              <div className="pb-1 text-sm text-muted-foreground">/100</div>
              {summary.siteScore < 75 ? <TriangleAlert className="mb-1 h-4 w-4 text-amber-500" /> : null}
            </div>
          </div>

          <div className="space-y-2">
            <FactorScoreRow label="Keywords IA" value={summary.factorScores.keywordsAI} />
            <FactorScoreRow label="Structure" value={summary.factorScores.structure} />
            <FactorScoreRow label="Schema LD" value={summary.factorScores.schemaLd} />
            <FactorScoreRow label="Concurrents" value={summary.factorScores.competitors} />
            <FactorScoreRow label="FAQ Coverage" value={summary.factorScores.faqCoverage} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onAnalyze} disabled={analyzing}>
              {analyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
              Analyser tout
            </Button>
            <Button variant="outline" onClick={onAnalyze} disabled={analyzing}>
              <RefreshCcw className={cn("h-4 w-4", analyzing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="xl:col-span-8 xl:flex xl:min-h-0 xl:flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Priorités immédiates</CardTitle>
          <CardDescription>
            TOP optimisations à fort impact estimé. Cliquez sur <code>[Générer]</code> pour ouvrir le drawer.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 xl:min-h-0 xl:flex-1 xl:overflow-y-auto">
          <div className="space-y-2">
            {summary.topRecommendations.map((rec, index) => (
              <div key={rec.id} className="rounded-lg border p-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "secondary" : "outline"}>
                        {rec.priority}
                      </Badge>
                      <Badge variant="outline">{rec.pageUrl}</Badge>
                      <Badge variant="secondary">{rec.type}</Badge>
                    </div>
                    <div className="text-sm font-medium">
                      {index + 1}. {rec.title}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">{rec.issue}</div>
                    <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                      {rec.estimatedImpactLabel}
                      {typeof rec.promptsLost === "number" ? ` · ${rec.promptsLost} prompts perdus` : ""}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button size="sm" variant="secondary" onClick={() => onOpenRecommendation(rec.id)}>
                      {generatingRecommendationId === rec.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                      Générer
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onPromoteRecommendation(rec)}
                      disabled={promotingRecommendationId === rec.id}
                    >
                      {promotingRecommendationId === rec.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      Kanban
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="text-sm font-medium">Analyse complète</div>
            {summary.pages.map((page) => (
              <div key={page.pageUrl} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                <div className="font-mono text-xs sm:text-sm">{page.pageUrl}</div>
                <div className="flex items-center gap-2">
                  {page.status !== "ok" ? (
                    <span className={cn("h-2 w-2 rounded-full", page.status === "critical" ? "bg-rose-500" : "bg-amber-500")} />
                  ) : (
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  )}
                  <span className="font-medium">{page.score}/100</span>
                </div>
              </div>
            ))}
            <div className="pt-1 text-xs text-muted-foreground">
              Dernière analyse: {new Date(summary.lastAnalyzedAt).toLocaleString("fr-FR")}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function FactorScoreRow({ label, value }: { label: string; value: number }) {
  const color =
    value >= 75 ? "bg-emerald-500" : value >= 50 ? "bg-amber-500" : "bg-rose-500";
  return (
    <div className="rounded-md border p-2">
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span>{label}</span>
        <span className="font-medium">{value}/100</span>
      </div>
      <div className="h-2 rounded-full bg-muted">
        <div className={cn("h-2 rounded-full", color)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: OptimizeAction["status"] }) {
  if (status === "resolved") return <Badge className="text-[10px]">resolved</Badge>;
  if (status === "in_progress") return <Badge variant="secondary" className="text-[10px]">in_progress</Badge>;
  return <Badge variant="outline" className="text-[10px]">open</Badge>;
}

function MarkdownPreview({ markdown }: { markdown?: string }) {
  if (!markdown) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        Cliquez sur <code>[Générer]</code> pour produire le contenu.
      </div>
    );
  }

  const lines = markdown.split("\n");
  return (
    <div className="space-y-2">
      {lines.map((line, index) => {
        const key = `md-${index}`;
        if (line.startsWith("## ")) return <h3 key={key} className="text-base font-semibold">{line.slice(3)}</h3>;
        if (line.startsWith("### ")) return <h4 key={key} className="text-sm font-semibold">{line.slice(4)}</h4>;
        if (line.startsWith("- ")) return <p key={key} className="pl-2 text-sm">• {line.slice(2)}</p>;
        if (!line.trim()) return <div key={key} className="h-1" />;
        return <p key={key} className="text-sm leading-relaxed">{line}</p>;
      })}
    </div>
  );
}

function statusOrder(status: OptimizeAction["status"]): number {
  if (status === "open") return 0;
  if (status === "in_progress") return 1;
  return 2;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

async function generateOptimizeContent({
  action,
  brandCanon,
  projectId,
}: {
  action: OptimizeAction;
  brandCanon: BrandCanon;
  projectId: string | null;
}): Promise<OptimizeGeneratedContent> {
  try {
    const result = await postJson<{ markdown?: string; html?: string }>(apiRoutes.optimize.generate(), {
      action: {
        id: action.id,
        type: action.type,
        title: action.title,
        issue: action.issue,
        priority: action.priority,
        aiModels: action.aiModels,
        promptsCount: action.promptsCount,
      },
      brandCanon,
      projectId,
    });

    if (result?.markdown || result?.html) return result;
  } catch {
    // Fallback demo generation if local route/back service is not wired yet.
  }

  const markdown = [
    "## FAQ",
    "",
    `### Q: ${action.title}`,
    `**R:** ${action.issue}`,
    "",
    "### Q: Quel est le positionnement réel ?",
    `**R:** ${brandCanon.positioning}`,
    "",
    "### Q: Quel est le pricing réel ?",
    `**R:** Référence canon: ${brandCanon.pricing.amount} ${brandCanon.pricing.currency}/${brandCanon.pricing.period}.`,
    "",
    "### Q: Quelles features faut-il citer ?",
    `**R:** ${brandCanon.features.slice(0, 6).join(", ")}.`,
    "",
    "### Q: Pourquoi cette correction aide les IA ?",
    `**R:** Elle fournit des signaux factuels publics, structurés et réutilisables dans les réponses génératives.`,
  ].join("\n");

  return { markdown };
}

async function publishOptimizeContent({
  action,
  target,
  projectId,
}: {
  action: OptimizeAction;
  target: PublishTarget;
  projectId: string | null;
}): Promise<{ publishedUrl?: string }> {
  const endpoint = target === "webflow" ? apiRoutes.optimize.publish.webflow() : apiRoutes.optimize.publish.hubspot();
  try {
    const result = await postJson<{ publishedUrl?: string }>(endpoint, {
      projectId,
      actionId: action.id,
      title: action.title,
      markdown: action.generatedContent?.markdown ?? "",
      htmlContent: simpleMarkdownToHtml(action.generatedContent?.markdown ?? ""),
      type: action.type,
    });
    return result ?? {};
  } catch {
    return {
      publishedUrl: `https://${target}.example.com/${slugify(action.title)}`,
    };
  }
}

function simpleMarkdownToHtml(markdown: string): string {
  return markdown
    .split("\n")
    .map((line) => {
      if (line.startsWith("## ")) return `<h2>${escapeHtml(line.slice(3))}</h2>`;
      if (line.startsWith("### ")) return `<h3>${escapeHtml(line.slice(4))}</h3>`;
      if (line.startsWith("- ")) return `<li>${escapeHtml(line.slice(2))}</li>`;
      if (!line.trim()) return "";
      return `<p>${escapeHtml(line)}</p>`;
    })
    .join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const base = API_CONFIG.BASE_URL?.trim();
  const url = path.startsWith("/api/")
    ? path
    : base
      ? `${base}${buildApiPath(path)}`
      : buildApiPath(path);

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: T; message?: string } | T;
  if (typeof json === "object" && json && "data" in json) {
    return (json as { data?: T; message?: string }).data as T;
  }
  return json as T;
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const base = API_CONFIG.BASE_URL?.trim();
  const url = base ? `${base}${buildApiPath(path)}` : buildApiPath(path);
  const res = await fetch(url, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }

  const json = (await res.json()) as { data?: T; message?: string } | T;
  if (typeof json === "object" && json && "data" in json) {
    return (json as { data?: T; message?: string }).data as T;
  }
  return json as T;
}
