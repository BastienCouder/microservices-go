"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  FileText,
  ListChecks,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { pushInfoToast } from "@/components/ui/toast-actions";
import type { OptimizationError } from "@/features/perception/_lib/shared/optimization-errors-data";
import { resolvePerceptionGeneratedContent } from "@/features/perception/_lib/perception-i18n";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type ErrorHubContentBriefsTabProps = {
  actionStatusesByErrorId: ReadonlyMap<string, string>;
  canGenerateAiBrief: boolean;
  errors: OptimizationError[];
  generatedContentByErrorId: ReadonlyMap<string, string>;
  generatedIds: ReadonlySet<string>;
  loading: boolean;
  onCreateAction: (error: OptimizationError) => void | Promise<void>;
  onOpenDetails: (error: OptimizationError) => void;
  savingErrorIds: ReadonlySet<string>;
};

const SOURCE_LABELS: Record<OptimizationError["source"], string> = {
  crawler: "sourceSite",
  monitoring: "sourceMonitoring",
  perception: "sourcePerception",
};

const FIX_TYPE_LABELS: Record<OptimizationError["fixType"], string> = {
  faq_snippet: "fixTypeFaq",
  prompt_patch: "fixTypePrompt",
  schema_update: "fixTypeStructure",
  website_copy: "fixTypeContent",
};

function priorityRank(error: OptimizationError) {
  if (error.optimizePriority === "high" || error.severity === "high") return 0;
  if (error.optimizePriority === "medium" || error.severity === "medium") return 1;
  return 2;
}

function priorityLabel(
  error: OptimizationError,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (priorityRank(error) === 0) return t("priorityHigh");
  if (priorityRank(error) === 1) return t("priorityMedium");
  return t("priorityLow");
}

function priorityTone(error: OptimizationError) {
  if (priorityRank(error) === 0) {
    return "border-destructive/30 bg-destructive/10 text-destructive";
  }

  if (priorityRank(error) === 1) {
    return "border-amber-300 bg-amber-500/10 text-amber-700";
  }

  return "border-emerald-300 bg-emerald-500/10 text-emerald-700";
}

function getOpportunitySearchText(error: OptimizationError) {
  return [
    error.title,
    error.issue,
    error.impact,
    error.generatedContent,
    error.resource ?? "",
    error.source,
    error.type,
    ...error.detectedInModels,
  ]
    .join(" ")
    .toLowerCase();
}

function sortOpportunities(errors: OptimizationError[]) {
  return [...errors].sort((left, right) => {
    const priorityDiff = priorityRank(left) - priorityRank(right);
    if (priorityDiff !== 0) return priorityDiff;

    if (left.source !== right.source) {
      return left.source.localeCompare(right.source);
    }

    return left.title.localeCompare(right.title);
  });
}

function splitGeneratedContent(value: string) {
  return value
    .split(/\n{2,}|\r?\n- |\r?\n\d+[.)]\s+/)
    .map((item) => item.replace(/^[-\d.)\s]+/, "").trim())
    .filter(Boolean);
}

function getBriefContent({
  actionContent,
}: {
  actionContent?: string;
}) {
  return (actionContent || "").trim();
}

function getActionStatusLabel(
  status: string | undefined,
  generated: boolean,
  t: (key: string, options?: Record<string, unknown>) => string,
) {
  if (status === "done") return t("statusDone");
  if (status === "processing") return t("statusProcessing");
  if (generated) return t("statusGenerated");
  return t("statusToGenerate");
}

export function ErrorHubContentBriefsTab({
  actionStatusesByErrorId,
  canGenerateAiBrief,
  errors,
  generatedContentByErrorId,
  generatedIds,
  loading,
  onCreateAction,
  onOpenDetails,
  savingErrorIds,
}: ErrorHubContentBriefsTabProps) {
  const { locale } = useScopedI18n("perception");
  const { t } = useScopedI18n("error-hub");
  const [query, setQuery] = useState("");
  const [selectedErrorId, setSelectedErrorId] = useState("");

  const filteredErrors = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const sorted = sortOpportunities(errors);

    if (!needle) return sorted;

    return sorted.filter((error) =>
      getOpportunitySearchText(error).includes(needle),
    );
  }, [errors, query]);

  const selectedError = useMemo(
    () =>
      filteredErrors.find((error) => error.id === selectedErrorId) ??
      filteredErrors[0] ??
      null,
    [filteredErrors, selectedErrorId],
  );

  useEffect(() => {
    if (!selectedError && selectedErrorId) {
      setSelectedErrorId("");
    }
  }, [selectedError, selectedErrorId]);

  if (loading) {
    return (
      <div className="grid min-h-[520px] gap-4 pt-4 lg:grid-cols-[320px_minmax(0,1fr)_360px]">
        <div className="animate-pulse rounded-md border bg-muted/30" />
        <div className="animate-pulse rounded-md border bg-muted/30" />
        <div className="animate-pulse rounded-md border bg-muted/30" />
      </div>
    );
  }

  if (errors.length === 0) {
    return (
      <div className="pt-4">
        <EmptyStateCard
          label={t("noContentOpportunity")}
          className="h-36 bg-background/70"
        />
      </div>
    );
  }

  const selectedGenerated = selectedError
    ? generatedIds.has(selectedError.id)
    : false;
  const selectedSaving = selectedError
    ? savingErrorIds.has(selectedError.id)
    : false;
  const selectedActionStatus = selectedError
    ? actionStatusesByErrorId.get(selectedError.id)
    : undefined;
  const selectedBrief = canGenerateAiBrief && selectedError
    ? getBriefContent({
        actionContent: generatedContentByErrorId.get(selectedError.id),
      })
    : "";
  const selectedInitialSuggestion = selectedError
    ? resolvePerceptionGeneratedContent(
        selectedError.generatedContent,
        selectedError.generatedContentKey,
        locale,
      ).trim()
    : "";
  const suggestionBlocks = selectedInitialSuggestion
    ? splitGeneratedContent(selectedInitialSuggestion).slice(0, 6)
    : [];
  const handleSelectedCreateAction = () => {
    if (!canGenerateAiBrief || !selectedError || selectedSaving) return;
    if (selectedGenerated) {
      pushInfoToast(
        t("alreadyCreatedTitle"),
        selectedBrief
          ? t("alreadyCreatedWithBrief")
          : t("alreadyCreatedWithoutBrief"),
      );
      return;
    }
    void onCreateAction(selectedError);
  };

  return (
    <div className="grid min-h-0 gap-4 pt-4 lg:h-full lg:grid-cols-[320px_minmax(0,1fr)_360px]">
      <aside className="flex min-h-[420px] flex-col rounded-md border bg-background">
        <div className="border-b p-3">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold">{t("opportunitiesTitle")}</h3>
              <p className="text-xs text-muted-foreground">
                {t("opportunitiesDescription")}
              </p>
            </div>
            <Badge variant="secondary" className="rounded-sm px-2 text-xs">
              {filteredErrors.length}
            </Badge>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("filterOpportunitiesPlaceholder")}
              className="pl-9"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
          {filteredErrors.length === 0 ? (
            <EmptyStateCard
              label={t("noOpportunityMatchesSearch")}
              className="h-24 bg-muted/30"
            />
          ) : (
            filteredErrors.map((error) => {
              const selected = selectedError?.id === error.id;
              const generated = generatedIds.has(error.id);

              return (
                <button
                  key={error.id}
                  type="button"
                  onClick={() => setSelectedErrorId(error.id)}
                  aria-pressed={selected}
                  className={cn(
                    "w-full rounded-md border bg-background p-3 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    selected && "border-primary bg-primary/5",
                  )}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    <Badge
                      variant="outline"
                      className={cn("rounded-sm px-1.5 text-[10px]", priorityTone(error))}
                    >
                      {priorityLabel(error, t)}
                    </Badge>
                    <Badge variant="secondary" className="rounded-sm px-1.5 text-[10px]">
                      {t(SOURCE_LABELS[error.source])}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm font-semibold leading-5">
                    {error.title}
                  </p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-muted-foreground">
                      {error.resource || t(FIX_TYPE_LABELS[error.fixType])}
                    </span>
                    {generated ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                    ) : null}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      <section className="flex min-h-[520px] flex-col rounded-md border bg-background">
        {selectedError ? (
          <>
            <div className="border-b p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge
                      variant="outline"
                      className={cn("rounded-sm px-2 text-xs", priorityTone(selectedError))}
                    >
                      {priorityLabel(selectedError, t)}
                    </Badge>
                    <Badge variant="secondary" className="rounded-sm px-2 text-xs">
                      {t(SOURCE_LABELS[selectedError.source])}
                    </Badge>
                    <Badge variant="outline" className="rounded-sm px-2 text-xs">
                      {getActionStatusLabel(selectedActionStatus, selectedGenerated, t)}
                    </Badge>
                  </div>
                  <h2 className="text-base font-semibold leading-7">
                    {selectedError.title}
                  </h2>
                  {selectedError.resource ? (
                    <p className="mt-1 break-all text-xs text-muted-foreground">
                      {selectedError.resource}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenDetails(selectedError)}
                >
                  {t("viewError")}
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {canGenerateAiBrief ? (
                <div className="mb-4 rounded-md border bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                    <Sparkles className="h-4 w-4" />
                    {t("aiBrief")}
                  </div>
                  {selectedBrief ? (
                    <div className="whitespace-pre-line text-sm leading-7 text-foreground/90">
                      {selectedBrief}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm leading-7 text-muted-foreground">
                        {t("noAiBriefYet")}
                      </p>
                      <Button
                        type="button"
                        disabled={selectedSaving}
                        onClick={handleSelectedCreateAction}
                      >
                        {selectedSaving ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        {selectedSaving ? t("generating") : t("generateAiBrief")}
                      </Button>
                    </div>
                  )}
                </div>
              ) : null}

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md border p-4">
                  <div className="mb-2 text-xs font-semibold text-primary">
                    {t("detectedProblem")}
                  </div>
                  <p className="text-sm leading-6 text-foreground/90">
                    {selectedError.issue || t("noDetailsProvided")}
                  </p>
                </div>
                <div className="rounded-md border p-4">
                  <div className="mb-2 text-xs font-semibold text-primary">
                    {t("impact")}
                  </div>
                  <p className="text-sm leading-6 text-foreground/90">
                    {selectedError.impact || t("impactToQualify")}
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <EmptyStateCard
            label={t("selectOpportunityForBrief")}
            className="m-4 h-36 bg-muted/30"
          />
        )}
      </section>

      <aside className="flex min-h-[420px] flex-col rounded-md border bg-background">
        <div className="border-b p-4">
          <h3 className="text-sm font-semibold">{t("actionsTitle")}</h3>
          <p className="text-xs text-muted-foreground">
            {t("initialSuggestion")}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {selectedError ? (
            <div className="space-y-3">
              {suggestionBlocks.length > 0 ? (
                suggestionBlocks.map((block, index) => (
                  <div key={`${selectedError.id}-${index}`} className="rounded-md border p-3">
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-primary">
                      {index === 0 ? (
                        <FileText className="h-4 w-4" />
                      ) : (
                        <ListChecks className="h-4 w-4" />
                      )}
                      {t("suggestionLabel", { count: index + 1 })}
                    </div>
                    <p className="whitespace-pre-line text-sm leading-6 text-foreground/90">
                      {block}
                    </p>
                  </div>
                ))
              ) : (
                <EmptyStateCard
                  label={t("noInitialSuggestion")}
                  className="h-32 bg-muted/30"
                />
              )}

              {canGenerateAiBrief ? (
                <Button
                  type="button"
                  className="w-full"
                  disabled={selectedSaving}
                  onClick={handleSelectedCreateAction}
                >
                  {selectedSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {selectedGenerated ? t("actionAiCreated") : t("generateAiAction")}
                </Button>
              ) : null}
            </div>
          ) : (
            <EmptyStateCard
              label={t("selectOpportunityForActions")}
              className="h-32 bg-muted/30"
            />
          )}
        </div>
      </aside>
    </div>
  );
}
