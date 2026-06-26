import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import type { ProjectModelMeta } from "@/lib/project-models";
import { appQueryKeys } from "@/lib/query-keys";
import { loadBillingEntitlements } from "@/shared/billing";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { useResolvedBillingOrganizationId } from "@/shared/use-resolved-billing-organization-id";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";
import { getOptimizationActionMatchIds } from "../optimization-action-ids";
import {
  resolvePerceptionGeneratedContent,
  resolvePerceptionLocalizedText,
} from "../perception-i18n";
import {
  loadOptimizationErrors,
  readOptimizationProjectIdFromSearch,
  type OptimizationError,
  type OptimizationErrorsBoard,
} from "./optimization-errors-data";
import type {
  OptimizePriority,
  PerceptionError,
} from "./perception-data";

type OptimizeActionStatus = "draft" | "published" | "processing" | "done" | string;

type PersistedOptimizeAction = {
  id: string;
  priority: OptimizePriority;
  type: PerceptionError["fixType"] | string;
  title: string;
  issue: string;
  impact?: string | null;
  generatedContent: string;
  status?: OptimizeActionStatus | null;
  sourceErrorId?: string | null;
  metadata?: Record<string, unknown> | null;
};

type AIBriefSettings = {
  projectId: string;
  briefModelId?: string;
  briefProvider?: string;
  briefProviderModelId?: string;
};

type SaveAIBriefSettingsInput = {
  briefModelId: string;
  briefProvider: string;
  briefProviderModelId: string;
};

type UseOptimizationErrorsResult = {
  aiBriefSettings: AIBriefSettings | null;
  competitors: string[];
  canGenerateAiBrief: boolean;
  data: OptimizationErrorsBoard | null;
  generatedIds: ReadonlySet<string>;
  generatedContentByErrorId: ReadonlyMap<string, string>;
  actionStatusesByErrorId: ReadonlyMap<string, OptimizeActionStatus>;
  loading: boolean;
  markingDoneErrorIds: ReadonlySet<string>;
  modelCatalog: ProjectModelMeta[];
  error: string | null;
  persistError: string | null;
  savingAIBriefSettings: boolean;
  savingErrorIds: ReadonlySet<string>;
  saveAIBriefSettings: (input: SaveAIBriefSettingsInput) => Promise<void>;
  handleFix: (error: OptimizationError) => Promise<void>;
  handleMarkDone: (error: OptimizationError) => Promise<void>;
  reload: () => Promise<void>;
};

export function useOptimizationErrors(apiBaseURL: string, routeSearch: string): UseOptimizationErrorsResult {
  const { locale } = useScopedI18n("perception");
  const projectId = readOptimizationProjectIdFromSearch(routeSearch);
  const organizationId = useMemo(
    () =>
      readOrganizationIdFromSearch(routeSearch) ||
      readSelectedOrganizationPublicID(),
    [routeSearch],
  );
  const billingOrganization = useResolvedBillingOrganizationId({
    apiBaseURL,
    organizationId,
  });
  const [persistedActions, setPersistedActions] = useState<PersistedOptimizeAction[]>([]);
  const [savingErrorIds, setSavingErrorIds] = useState<Set<string>>(new Set());
  const [markingDoneErrorIds, setMarkingDoneErrorIds] = useState<Set<string>>(new Set());
  const [persistError, setPersistError] = useState<string | null>(null);
  const [aiBriefSettingsData, setAIBriefSettingsData] = useState<AIBriefSettings | null>(null);
  const query = useQuery({
    queryKey: appQueryKeys.optimizationErrors(
      apiBaseURL,
      projectId,
      organizationId || null,
    ),
    enabled: apiBaseURL.trim() !== "",
    queryFn: () => loadOptimizationErrors(apiBaseURL, routeSearch),
  });
  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, billingOrganization.organizationId),
    enabled: apiBaseURL.trim() !== "" && billingOrganization.organizationId.trim() !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, billingOrganization.organizationId, { signal }),
  });
  const canGenerateAiBrief = billingQuery.data?.allowAiBriefs === true;
  const [savingAIBriefSettings, setSavingAIBriefSettings] = useState(false);

  const generatedIds = useMemo(
    () =>
      new Set(
        persistedActions
          .flatMap((action) => getOptimizationActionMatchIds(action.sourceErrorId || action.id)),
      ),
    [persistedActions],
  );
  const actionsByErrorId = useMemo(() => {
    const actions = new Map<string, PersistedOptimizeAction>();
    for (const action of persistedActions) {
      const errorIds = getOptimizationActionMatchIds(action.sourceErrorId || action.id);
      for (const errorId of errorIds) {
        if (!actions.has(errorId)) actions.set(errorId, action);
      }
    }
    return actions;
  }, [persistedActions]);
  const actionStatusesByErrorId = useMemo(() => {
    const statuses = new Map<string, OptimizeActionStatus>();
    for (const [errorId, action] of actionsByErrorId) {
      statuses.set(errorId, action.status || "draft");
    }
    return statuses;
  }, [actionsByErrorId]);
  const generatedContentByErrorId = useMemo(() => {
    const content = new Map<string, string>();
    for (const [errorId, action] of actionsByErrorId) {
      if (action.metadata?.briefSource === "ai") {
        content.set(errorId, action.generatedContent);
      }
    }
    return content;
  }, [actionsByErrorId]);

  const handleFix = useCallback(
    async (error: OptimizationError) => {
      setPersistError(null);
      if (!canGenerateAiBrief) return;
      if (savingErrorIds.has(error.id) || generatedIds.has(error.id)) return;

      const localizedGeneratedContent = resolvePerceptionGeneratedContent(
        error.generatedContent,
        error.generatedContentKey,
        locale,
        error.translationParams,
      );
      const localizedTitle = resolvePerceptionLocalizedText(
        error.title,
        error.titleKey,
        locale,
        error.translationParams,
      );
      const localizedIssue = resolvePerceptionLocalizedText(
        error.issue,
        error.issueKey,
        locale,
        error.translationParams,
      );
      const localizedImpact = resolvePerceptionLocalizedText(
        error.impact,
        error.impactKey,
        locale,
        error.translationParams,
      );

      setSavingErrorIds((current) => new Set(current).add(error.id));
      setPersistedActions((current) => [
        {
          id: `local-${error.id}-${Date.now()}`,
          priority: error.optimizePriority,
          type: error.fixType,
          title: localizedTitle,
          issue: localizedIssue,
          impact: localizedImpact,
          generatedContent: localizedGeneratedContent,
          status: "processing",
          sourceErrorId: error.id,
          metadata: {
            briefSource: "ai",
            source: error.source,
            detectedInModels: error.detectedInModels,
            aiModels: error.detectedInModels,
            createdBy: "ai",
            workflow: "error_hub_fix",
            promptsCount: 0,
          },
        },
        ...current,
      ]);
      setSavingErrorIds((current) => {
        const next = new Set(current);
        next.delete(error.id);
        return next;
      });
    },
    [canGenerateAiBrief, generatedIds, locale, savingErrorIds],
  );

  const saveAIBriefSettings = useCallback(
    async (input: SaveAIBriefSettingsInput) => {
      if (savingAIBriefSettings) return;
      setPersistError(null);
      setSavingAIBriefSettings(true);
      setAIBriefSettingsData({
        projectId: query.data?.projectId ?? projectId ?? "",
        ...input,
      });
      setSavingAIBriefSettings(false);
    },
    [projectId, query.data?.projectId, savingAIBriefSettings],
  );

  const handleMarkDone = useCallback(
    async (error: OptimizationError) => {
      setPersistError(null);
      const action = actionsByErrorId.get(error.id);
      if (!action || action.status === "done" || markingDoneErrorIds.has(error.id)) return;

      setMarkingDoneErrorIds((current) => new Set(current).add(error.id));
      setPersistedActions((current) =>
        current.map((item) => (item.id === action.id ? { ...item, status: "done" } : item)),
      );
      setMarkingDoneErrorIds((current) => {
        const next = new Set(current);
        next.delete(error.id);
        return next;
      });
    },
    [actionsByErrorId, markingDoneErrorIds],
  );

  const reload = useCallback(async () => {
    await query.refetch();
  }, [query]);

  return {
    aiBriefSettings: aiBriefSettingsData,
    competitors: query.data?.competitors ?? [],
    canGenerateAiBrief,
    data: query.data?.data ?? null,
    generatedIds,
    generatedContentByErrorId,
    actionStatusesByErrorId,
    loading: query.isLoading || (query.isFetching && !query.data),
    markingDoneErrorIds,
    modelCatalog: query.data?.modelCatalog ?? [],
    error: query.error instanceof Error ? query.error.message : null,
    persistError,
    savingAIBriefSettings,
    savingErrorIds,
    saveAIBriefSettings,
    handleFix,
    handleMarkDone,
    reload,
  };
}
