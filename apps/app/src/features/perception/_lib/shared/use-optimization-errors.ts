import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { pushErrorToast } from "@/components/ui/toast-actions";
import { apiRoutes } from "@/lib/api-config";
import type { ProjectModelMeta } from "@/lib/project-models";
import { appQueryKeys } from "@/lib/query-keys";
import { loadBillingEntitlements } from "@/shared/billing";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { useResolvedBillingOrganizationId } from "@/shared/use-resolved-billing-organization-id";
import {
  readOrganizationIdFromSearch,
  readSelectedOrganizationPublicID,
} from "@/shared/selection";
import { getPerceptionClientJSON, patchPerceptionClientJSON, postPerceptionClientJSON } from "../client-api";
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

const DISABLE_GATEWAY_TIMEOUT_MS = 0;

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
  const { locale, t } = useScopedI18n("perception");
  const { t: tErrorHub } = useScopedI18n("error-hub");
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
  const query = useQuery({
    queryKey: appQueryKeys.optimizationErrors(
      apiBaseURL,
      projectId,
      organizationId || null,
    ),
    enabled: apiBaseURL.trim() !== "",
    queryFn: () => loadOptimizationErrors(apiBaseURL, routeSearch),
  });
  const activeProjectId = query.data?.projectId ?? projectId ?? "";
  const billingQuery = useQuery({
    queryKey: appQueryKeys.billingQuota(apiBaseURL, billingOrganization.organizationId),
    enabled: apiBaseURL.trim() !== "" && billingOrganization.organizationId.trim() !== "",
    queryFn: ({ signal }) =>
      loadBillingEntitlements(apiBaseURL, billingOrganization.organizationId, { signal }),
  });
  const canGenerateAiBrief = billingQuery.data?.allowAiBriefs === true;
  const actionOrganizationId = organizationId?.trim() || undefined;
  const {
    data: aiBriefSettingsData,
    refetch: refetchAIBriefSettings,
  } = useQuery({
    queryKey: appQueryKeys.aiBriefSettings(
      apiBaseURL,
      activeProjectId || null,
      organizationId || null,
    ),
    enabled: apiBaseURL.trim() !== "" && activeProjectId.trim() !== "",
    queryFn: () =>
      getPerceptionClientJSON<AIBriefSettings>(
        apiRoutes.analysis.aiBriefSettings(activeProjectId),
        { organizationId: actionOrganizationId },
      ),
  });
  const [savingAIBriefSettings, setSavingAIBriefSettings] = useState(false);

  useEffect(() => {
    if (!activeProjectId) return;

    let isMounted = true;
    void getPerceptionClientJSON<PersistedOptimizeAction[]>(
      apiRoutes.analysis.optimizeActions(activeProjectId),
      { organizationId: actionOrganizationId },
    )
      .then((actions) => {
        if (isMounted) {
          setPersistedActions(actions);
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [activeProjectId, actionOrganizationId]);

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
      if (savingErrorIds.has(error.id) || generatedIds.has(error.id) || !activeProjectId) return;

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
      try {
        const result = await postPerceptionClientJSON<{
          id: string;
          generatedContent?: string;
          status: OptimizeActionStatus;
        }>(
          apiRoutes.analysis.optimizeActions(activeProjectId),
          {
            priority: error.optimizePriority,
            type: error.fixType,
            title: localizedTitle,
            issue: localizedIssue,
            impact: localizedImpact,
            generatedContent: localizedGeneratedContent,
            status: "processing",
            sourceErrorId: error.id,
            metadata: {
              source: error.source,
              detectedInModels: error.detectedInModels,
              aiModels: error.detectedInModels,
              createdBy: "ai",
              workflow: "error_hub_fix",
              promptsCount: 0,
            },
          },
          { organizationId: actionOrganizationId, timeoutMs: DISABLE_GATEWAY_TIMEOUT_MS },
        );

        setPersistedActions((current) => [
          {
            id: result.id,
            priority: error.optimizePriority,
            type: error.fixType,
            title: localizedTitle,
            issue: localizedIssue,
            impact: localizedImpact,
            generatedContent: result.generatedContent || localizedGeneratedContent,
            status: result.status || "processing",
            sourceErrorId: error.id,
            metadata: { briefSource: "ai" },
          },
          ...current,
        ]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : t("optimizeActionsCreateError");
        setPersistError(message);
        pushErrorToast(err, message);
      } finally {
        setSavingErrorIds((current) => {
          const next = new Set(current);
          next.delete(error.id);
          return next;
        });
      }
    },
    [activeProjectId, actionOrganizationId, canGenerateAiBrief, generatedIds, locale, savingErrorIds, t],
  );

  const saveAIBriefSettings = useCallback(
    async (input: SaveAIBriefSettingsInput) => {
      if (!activeProjectId || savingAIBriefSettings) return;
      setPersistError(null);
      setSavingAIBriefSettings(true);
      try {
        await patchPerceptionClientJSON<AIBriefSettings>(
          apiRoutes.analysis.aiBriefSettings(activeProjectId),
          input,
          { organizationId: actionOrganizationId },
        );
        refetchAIBriefSettings().catch(() => undefined);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : tErrorHub("aiBriefModelSaveError");
        setPersistError(message);
        pushErrorToast(err, message);
        throw err;
      } finally {
        setSavingAIBriefSettings(false);
      }
    },
    [activeProjectId, actionOrganizationId, refetchAIBriefSettings, savingAIBriefSettings, tErrorHub],
  );

  const handleMarkDone = useCallback(
    async (error: OptimizationError) => {
      setPersistError(null);
      const action = actionsByErrorId.get(error.id);
      if (!action || action.status === "done" || markingDoneErrorIds.has(error.id) || !activeProjectId) return;

      setMarkingDoneErrorIds((current) => new Set(current).add(error.id));
      const previousStatus = action.status || "processing";
      setPersistedActions((current) =>
        current.map((item) => (item.id === action.id ? { ...item, status: "done" } : item)),
      );

      try {
        const result = await patchPerceptionClientJSON<{ id: string; status: OptimizeActionStatus }>(
          apiRoutes.analysis.optimizeAction(activeProjectId, action.id),
          { status: "done" },
          { organizationId: actionOrganizationId },
        );
        setPersistedActions((current) =>
          current.map((item) =>
            item.id === action.id ? { ...item, status: result.status || "done" } : item,
          ),
        );
      } catch (err) {
        setPersistedActions((current) =>
          current.map((item) => (item.id === action.id ? { ...item, status: previousStatus } : item)),
        );
        const message =
          err instanceof Error ? err.message : t("optimizeActionsCreateError");
        setPersistError(message);
        pushErrorToast(err, message);
      } finally {
        setMarkingDoneErrorIds((current) => {
          const next = new Set(current);
          next.delete(error.id);
          return next;
        });
      }
    },
    [actionOrganizationId, actionsByErrorId, activeProjectId, markingDoneErrorIds, t],
  );

  const reload = useCallback(async () => {
    await query.refetch();
  }, [query.refetch]);

  return {
    aiBriefSettings: aiBriefSettingsData ?? null,
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
