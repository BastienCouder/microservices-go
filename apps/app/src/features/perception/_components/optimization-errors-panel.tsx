"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type {
  PerceptionError,
  PerceptionModelOption,
} from "../_lib/shared/perception-data";
import { buildProviderLabel } from "@/lib/project-models";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/shared/section-title";
import { buildScopedHref } from "@/shared/selection";
import {
  translateI18nText,
  useScopedI18n,
} from "@/shared/hooks/use-i18n";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import i18n from "@/shared/i18n";
import { findAIProviderAsset } from "@/lib/ai-provider-assets";
import {
  formatPerceptionErrorTypeLabel as formatPerceptionErrorTypeLabelI18n,
  formatPerceptionPriorityLabel as formatPerceptionPriorityLabelI18n,
  formatPerceptionStatusLabel as formatPerceptionStatusLabelI18n,
  getPerceptionActionStatusTone,
  resolvePerceptionLocalizedText,
  resolvePerceptionGeneratedContent,
  getPerceptionSeverityLabel,
  getPerceptionPriorityTone,
} from "../_lib";

type ErrorContextBadge = {
  label: string;
  className?: string;
};

type ErrorMetaRow = {
  label: string;
  value: string;
};

export function OptimizationErrorsPanel({
  emptyLabel,
  errors,
  generatedIds,
  modelCatalog,
  onCreateAction,
  onRemoveAction,
  projectId,
  savingErrorIds,
  showSeeMore = true,
  totalErrorCount = errors.length,
}: {
  emptyLabel?: string | null;
  errors: PerceptionError[];
  generatedIds?: ReadonlySet<string>;
  modelCatalog?: PerceptionModelOption[];
  onCreateAction?: (error: PerceptionError) => void | Promise<void>;
  onRemoveAction?: (error: PerceptionError) => void | Promise<void>;
  projectId?: string | null;
  savingErrorIds?: ReadonlySet<string>;
  showSeeMore?: boolean;
  totalErrorCount?: number;
}) {
  const { locale, t } = useScopedI18n("perception");
  const [selectedError, setSelectedError] = useState<PerceptionError | null>(
    null,
  );
  const isMobile = useIsMobile();
  const modelLookup = useMemo(
    () => buildPerceptionModelLookup(modelCatalog ?? []),
    [modelCatalog],
  );
  const handleDetailsOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedError(null);
    }
  };
  const selectedActionGenerated = selectedError
    ? (generatedIds?.has(selectedError.id) ?? false)
    : false;
  const selectedActionSaving = selectedError
    ? (savingErrorIds?.has(selectedError.id) ?? false)
    : false;
  const selectedErrorTitle = selectedError
    ? resolvePerceptionLocalizedText(
        selectedError.title,
        selectedError.titleKey,
        locale,
        selectedError.translationParams,
      )
    : "";
  const seeMoreHref = buildScopedHref("/error-hub", {
    project: projectId,
    source: "perception",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h4>
            <SectionTitle>{t("optimizationErrorsTitle")}</SectionTitle>
          </h4>
        </div>
        <Badge
          variant="secondary"
          className="h-5 bg-primary/10 px-1.5 font-mono text-[10px] text-primary"
        >
          {totalErrorCount}
        </Badge>
      </div>

      <div className="space-y-3">
        {errors.length === 0 ? (
          <EmptyStateCard
            label={emptyLabel || `${t("optimizationErrorsEmptyTitle")}.`}
            className="h-[120px] text-sm"
          />
        ) : (
          errors.map((error, index) => (
            <OptimizationErrorCard
              key={error.id}
              error={error}
              index={index}
              onOpenDetails={() => setSelectedError(error)}
              locale={locale}
              modelLookup={modelLookup}
              actionGenerated={generatedIds?.has(error.id) ?? false}
              actionSaving={savingErrorIds?.has(error.id) ?? false}
              onCreateAction={
                onCreateAction ? () => void onCreateAction(error) : undefined
              }
              onRemoveAction={
                onRemoveAction ? () => void onRemoveAction(error) : undefined
              }
              showProviderIconsOnly
              showIndex={false}
              hideFooter
            />
          ))
        )}

        {showSeeMore ? (
          <Button asChild variant="ghost" size="sm" className="w-full text-xs">
            <Link to={seeMoreHref}>{t("optimizationErrorsSeeMore")}</Link>
          </Button>
        ) : null}
      </div>

      {selectedError ? (
        isMobile ? (
          <Drawer
            open={selectedError !== null}
            onOpenChange={handleDetailsOpenChange}
          >
            <DrawerContent className="h-[94vh] rounded-t-xl border-none bg-white">
              <DrawerHeader className="sr-only">
                <DrawerTitle>{selectedErrorTitle}</DrawerTitle>
                <DrawerDescription>
                  {t("optimizationErrorsSheetDescription")}
                </DrawerDescription>
              </DrawerHeader>
              <ErrorDetailsContent
                error={selectedError}
                locale={locale}
                modelLookup={modelLookup}
                mobile
                actionGenerated={selectedActionGenerated}
                actionSaving={selectedActionSaving}
                onCreateAction={
                  onCreateAction
                    ? () => void onCreateAction(selectedError)
                    : undefined
                }
                onRemoveAction={
                  onRemoveAction
                    ? () => void onRemoveAction(selectedError)
                    : undefined
                }
              />
            </DrawerContent>
          </Drawer>
        ) : (
          <Sheet
            open={selectedError !== null}
            onOpenChange={handleDetailsOpenChange}
          >
            <SheetContent side="right" className="!max-w-2xl">
              <SheetHeader className="sr-only">
                <SheetTitle>{selectedErrorTitle}</SheetTitle>
                <SheetDescription>
                  {t("optimizationErrorsSheetDescription")}
                </SheetDescription>
              </SheetHeader>
              <ErrorDetailsContent
                error={selectedError}
                locale={locale}
                modelLookup={modelLookup}
                mobile={false}
                actionGenerated={selectedActionGenerated}
                actionSaving={selectedActionSaving}
                onCreateAction={
                  onCreateAction
                    ? () => void onCreateAction(selectedError)
                    : undefined
                }
                onRemoveAction={
                  onRemoveAction
                    ? () => void onRemoveAction(selectedError)
                    : undefined
                }
              />
            </SheetContent>
          </Sheet>
        )
      ) : null}
    </div>
  );
}

function ErrorDataRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-50 pb-5">
      <span className="text-xs font-bold text-primary">{label}</span>
      <span className="min-w-0 text-right text-sm font-semibold [overflow-wrap:anywhere]">
        {value}
      </span>
    </div>
  );
}

function ErrorTextBlock({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-3 pt-2">
      <div className="text-xs font-bold tracking-widest text-primary">
        {label}
      </div>
      <div className="rounded-xl border border-slate-100 px-4 py-4 text-sm leading-7 text-foreground/90 [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}

export function ErrorDetailsContent({
  actionGenerated = false,
  actionSaving = false,
  actionStatus,
  contextBadge,
  contextMeta,
  error,
  locale,
  markingActionDone = false,
  modelLookup,
  mobile,
  onCreateAction,
  onMarkActionDone,
  onRemoveAction,
}: {
  actionGenerated?: boolean;
  actionSaving?: boolean;
  actionStatus?: string;
  contextBadge?: ErrorContextBadge;
  contextMeta?: ErrorMetaRow;
  error: PerceptionError;
  locale: string;
  markingActionDone?: boolean;
  modelLookup: ReadonlyMap<string, PerceptionModelOption>;
  mobile: boolean;
  onCreateAction?: () => void;
  onMarkActionDone?: () => void;
  onRemoveAction?: () => void;
}) {
  const { t } = useScopedI18n("perception");
  const severity = getSeverityTone(error.severity, locale);
  const resolvedTitle = resolvePerceptionLocalizedText(
    error.title,
    error.titleKey,
    locale,
    error.translationParams,
  );
  const resolvedIssue = resolvePerceptionLocalizedText(
    error.issue,
    error.issueKey,
    locale,
    error.translationParams,
  );
  const resolvedImpact = resolvePerceptionLocalizedText(
    error.impact,
    error.impactKey,
    locale,
    error.translationParams,
  );
  const resolvedGeneratedContent = resolvePerceptionGeneratedContent(
    error.generatedContent,
    error.generatedContentKey,
    locale,
    error.translationParams,
  );
  const canRemoveAction = Boolean(actionGenerated && onRemoveAction);
  const canMarkDone = Boolean(
    actionStatus && actionStatus !== "done" && onMarkActionDone,
  );
  const shouldShowActionButton = Boolean(
    onCreateAction && (actionStatus !== "done" || canRemoveAction),
  );
  const actionButtonHandler =
    canRemoveAction && !canMarkDone
      ? onRemoveAction
      : canMarkDone
        ? onMarkActionDone
        : onCreateAction;
  const actionButtonLabel =
    canRemoveAction && !canMarkDone
      ? t("optimizationErrorsRemove")
      : canMarkDone
        ? t("optimizationErrorsMarkDone")
        : actionGenerated
          ? t("optimizationErrorsAdded")
          : t("optimizationErrorsFix");

  return (
    <div
      className={cn(
        "flex h-full flex-col bg-white font-sans antialiased",
        mobile && "overflow-y-auto",
      )}
    >
      <div className={cn("px-8 pt-10", mobile && "px-6 pt-6")}>
        <div className="mb-10 flex flex-col items-start justify-between gap-4">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={cn(
                  "text-sm",
                  getPerceptionPriorityTone(error.optimizePriority),
                )}
              >
                {formatPerceptionPriorityLabelI18n(
                  error.optimizePriority,
                  locale,
                )}
              </Badge>
              {contextBadge ? (
                <Badge
                  variant="outline"
                  className={cn("text-sm", contextBadge.className)}
                >
                  {contextBadge.label}
                </Badge>
              ) : null}
              {error.detectedInModels.map((model) => {
                const modelBadge = getPerceptionModelBadgeMeta(
                  model,
                  modelLookup,
                );

                return (
                  <span
                    key={`details-${error.id}-${model}`}
                    className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-100 bg-white px-3 py-1.5 text-sm font-medium text-foreground"
                    title={modelBadge.title}
                  >
                    <ModelBadgeIcon model={modelBadge} className="h-4 w-4" />
                    <span className="min-w-0 truncate">
                      {modelBadge.provider} - {modelBadge.name}
                    </span>
                  </span>
                );
              })}
            </div>

            <h1 className="[overflow-wrap:anywhere] text-xl leading-tight tracking-tight md:text-3xl">
              {resolvedTitle}
            </h1>

            {shouldShowActionButton ? (
              <Button
                type="button"
                className="w-fit"
                disabled={
                  actionSaving ||
                  markingActionDone ||
                  (actionStatus === "done" && !canRemoveAction) ||
                  (actionGenerated && !canMarkDone && !canRemoveAction)
                }
                onClick={actionButtonHandler}
              >
                {actionButtonLabel}
              </Button>
            ) : null}
          </div>
        </div>
      </div>

      <div className={cn("flex-1 px-8", mobile ? "px-6" : "overflow-y-auto")}>
        <div className="grid grid-cols-1 gap-y-10 pb-8">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-bold tracking-widest text-primary">
              {t("optimizationErrorsImpact")}
            </span>
            <span
              className={cn(
                "text-4xl font-extralight tracking-tighter md:text-6xl",
                severity.label,
              )}
            >
              {severity.tag}
            </span>
          </div>

          <div className="space-y-7">
            {contextMeta ? (
              <ErrorDataRow label={contextMeta.label} value={contextMeta.value} />
            ) : null}
            <ErrorDataRow
              label={t("optimizationErrorsGeneratedFix")}
              value={formatPerceptionErrorTypeLabelI18n(error.type, locale)}
            />
          </div>

          <ErrorTextBlock label={t("optimizationErrorsAiClaim")}>
            <p>{resolvedIssue}</p>
          </ErrorTextBlock>

          <ErrorTextBlock label={t("optimizationErrorsImpact")}>
            <p>{resolvedImpact}</p>
          </ErrorTextBlock>

          <ErrorTextBlock label={t("optimizationErrorsGeneratedFix")}>
            <p>{resolvedGeneratedContent}</p>
          </ErrorTextBlock>
        </div>
      </div>
    </div>
  );
}

function getSeverityTone(
  severity: PerceptionError["severity"],
  locale: string,
) {
  if (severity === "high") {
    return {
      dot: "bg-rose-500",
      label: "text-rose-500",
      tag: getPerceptionSeverityLabel("high", locale),
    };
  }
  if (severity === "medium") {
    return {
      dot: "bg-amber-500",
      label: "text-amber-600",
      tag: getPerceptionSeverityLabel("medium", locale),
    };
  }
  return {
    dot: "bg-green-500",
    label: "text-green-700",
    tag: getPerceptionSeverityLabel("low", locale),
  };
}

type PerceptionModelBadgeMeta = {
  iconPath: string;
  name: string;
  provider: string;
  title: string;
};

function normalizeModelLookupKey(value: string): string {
  return value.trim().toLowerCase();
}

export function buildPerceptionModelLookup(
  models: PerceptionModelOption[],
): Map<string, PerceptionModelOption> {
  const lookup = new Map<string, PerceptionModelOption>();

  for (const model of models) {
    for (const value of [
      model.id,
      model.providerModelId,
      model.displayName,
      model.groupName,
    ]) {
      const key = normalizeModelLookupKey(value);
      if (key) lookup.set(key, model);
    }
  }

  return lookup;
}

function findProviderVisual(provider: string, modelName: string) {
  return findAIProviderAsset(provider, modelName);
}

function getProviderModelName(providerModelId: string): string {
  const parts = providerModelId
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
  return parts.at(-1) ?? providerModelId.trim();
}

function getPerceptionModelBadgeMeta(
  modelName: string,
  modelLookup: ReadonlyMap<string, PerceptionModelOption>,
): PerceptionModelBadgeMeta {
  const model = modelLookup.get(normalizeModelLookupKey(modelName));

  if (model) {
    const providerVisual = findProviderVisual(
      model.provider,
      model.providerModelId || model.displayName,
    );
    const provider =
      providerVisual?.provider ?? buildProviderLabel(model.provider);
    const name =
      model.displayName ||
      getProviderModelName(model.providerModelId) ||
      model.groupName ||
      model.id;

    return {
      iconPath: providerVisual?.iconPath || model.iconPath,
      name,
      provider: provider || translateI18nText("shared-ui", "aiProvider", i18n.language),
      title: `${provider || translateI18nText("shared-ui", "aiProvider", i18n.language)} - ${name}`,
    };
  }

  const providerVisual = findProviderVisual("", modelName);
  const provider = providerVisual?.provider ?? translateI18nText("shared-ui", "aiProvider", i18n.language);
  const name = getProviderModelName(modelName) || modelName || translateI18nText("shared-ui", "aiModel", i18n.language);

  return {
    iconPath: providerVisual?.iconPath ?? "",
    name,
    provider,
    title: `${provider} - ${name}`,
  };
}

function getUniqueProviderModelBadges(
  modelNames: string[],
  modelLookup: ReadonlyMap<string, PerceptionModelOption>,
) {
  const badges: PerceptionModelBadgeMeta[] = [];
  const seenProviders = new Set<string>();

  for (const modelName of modelNames) {
    const badge = getPerceptionModelBadgeMeta(modelName, modelLookup);
    const providerKey = normalizeModelLookupKey(badge.provider);
    if (seenProviders.has(providerKey)) continue;
    seenProviders.add(providerKey);
    badges.push(badge);
  }

  return badges;
}

function ModelBadgeIcon({
  className,
  model,
}: {
  className: string;
  model: PerceptionModelBadgeMeta;
}) {
  if (!model.iconPath) {
    return (
      <span
        className={cn(
          "shrink-0 rounded-full bg-muted-foreground/40",
          className,
        )}
      />
    );
  }

  return (
    <img
      src={model.iconPath}
      alt={model.provider}
      className={cn("shrink-0 object-contain", className)}
      decoding="async"
      loading="lazy"
    />
  );
}

export function OptimizationErrorCard({
  actionGenerated = false,
  actionSaving = false,
  actionStatus,
  contextBadge,
  contextMeta,
  error,
  footerAlign = "split",
  index,
  markingActionDone = false,
  showIndex = true,
  showProviderIconsOnly = false,
  hideFooter = false,
  footerMeta,
  modelLookup = new Map(),
  onOpenDetails,
  onCreateAction,
  onMarkActionDone,
  onRemoveAction,
  locale,
}: {
  actionGenerated?: boolean;
  actionSaving?: boolean;
  actionStatus?: string;
  contextBadge?: ErrorContextBadge;
  contextMeta?: ErrorMetaRow;
  error: PerceptionError;
  footerAlign?: "split" | "end";
  index: number;
  markingActionDone?: boolean;
  showIndex?: boolean;
  showProviderIconsOnly?: boolean;
  hideFooter?: boolean;
  footerMeta?: string;
  modelLookup?: ReadonlyMap<string, PerceptionModelOption>;
  onOpenDetails: () => void;
  onCreateAction?: () => void;
  onMarkActionDone?: () => void;
  onRemoveAction?: () => void;
  locale: string;
}) {
  const { t } = useScopedI18n("perception");
  const tone = getSeverityTone(error.severity, locale);
  const statusTone = getPerceptionActionStatusTone(actionStatus);
  const canRemoveAction = Boolean(actionGenerated && onRemoveAction);
  const canMarkDone = Boolean(
    actionStatus && actionStatus !== "done" && onMarkActionDone,
  );
  const shouldShowActionButton = Boolean(
    onCreateAction && (actionStatus !== "done" || canRemoveAction),
  );
  const actionButtonHandler =
    canRemoveAction && !canMarkDone
      ? onRemoveAction
      : canMarkDone
        ? onMarkActionDone
        : onCreateAction;
  const actionButtonLabel =
    canRemoveAction && !canMarkDone
      ? t("optimizationErrorsRemove")
      : canMarkDone
        ? t("optimizationErrorsMarkDone")
        : actionGenerated
          ? t("optimizationErrorsAdded")
          : t("optimizationErrorsFix");
  const resolvedGeneratedContent = resolvePerceptionGeneratedContent(
    error.generatedContent,
    error.generatedContentKey,
    locale,
    error.translationParams,
  );
  const resolvedTitle = resolvePerceptionLocalizedText(
    error.title,
    error.titleKey,
    locale,
    error.translationParams,
  );
  const resolvedIssue = resolvePerceptionLocalizedText(
    error.issue,
    error.issueKey,
    locale,
    error.translationParams,
  );
  const primaryModel = error.detectedInModels[0]
    ? getPerceptionModelBadgeMeta(error.detectedInModels[0], modelLookup)
    : null;
  const providerIconBadges = showProviderIconsOnly
    ? getUniqueProviderModelBadges(error.detectedInModels, modelLookup)
    : [];

  return (
    <div className="group w-full rounded-xl bg-background p-4 text-left transition-all hover:ring-2 hover:ring-primary/20">
      <button
        type="button"
        className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={onOpenDetails}
        aria-label={``}
      >
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {showProviderIconsOnly ? (
              <div className={cn("h-3.5 w-3.5 shrink-0 rounded-full", tone.dot)} />
            ) : primaryModel ? (
              <div className="rounded-lg border border-border/50 bg-white p-1">
                <ModelBadgeIcon
                  model={primaryModel}
                  className="h-3.5 w-3.5"
                />
              </div>
            ) : (
              <div className={cn("h-3.5 w-3.5 rounded-full", tone.dot)} />
            )}

            <div className="min-w-0">
              <p
                className={cn(
                  "truncate text-xs font-semibold md:text-sm",
                  tone.label,
                )}
              >
                {tone.tag}
              </p>
              {contextMeta && !contextBadge ? (
                <p className="truncate text-[11px] font-semibold text-muted-foreground md:text-xs">
                  {contextMeta.value}
                </p>
              ) : null}
              <p className="truncate text-[11px] text-muted-foreground/80 md:text-xs">
                {formatPerceptionErrorTypeLabelI18n(error.type, locale)}
              </p>
              {contextBadge ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "mt-1 h-5 rounded-sm px-1.5 text-[10px] font-semibold",
                    contextBadge.className,
                  )}
                >
                  {contextBadge.label}
                </Badge>
              ) : null}
            </div>
          </div>

          {showIndex ? (
            <span className="font-mono text-xs text-muted-foreground">
              #{index + 1}
            </span>
          ) : null}
        </div>

        <p className="mb-2 line-clamp-2 text-xs font-semibold leading-relaxed text-foreground/90 transition-colors group-hover:text-foreground md:text-sm">
          {resolvedTitle}
        </p>
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {resolvedIssue}
        </p>
        {contextMeta ? (
          <div className="mb-3">
            <Badge
              variant="outline"
              className="inline-flex max-w-full items-center gap-1.5 rounded-lg border-border/70 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground"
              title={`${contextMeta.label}: ${contextMeta.value}`}
            >
              <span className="shrink-0 text-muted-foreground">
                {contextMeta.label}
              </span>
              <span className="truncate text-foreground/90">
                {contextMeta.value}
              </span>
            </Badge>
          </div>
        ) : null}
      </button>

      {showProviderIconsOnly && providerIconBadges.length > 0 ? (
        <div className="mt-3 flex items-center gap-1.5 border-t border-border/40 pt-3">
          {providerIconBadges.map((modelBadge) => (
            <span
              key={modelBadge.provider}
              className="rounded-lg border border-border/50 bg-white p-1"
              title={modelBadge.provider}
            >
              <ModelBadgeIcon model={modelBadge} className="h-3.5 w-3.5" />
            </span>
          ))}
        </div>
      ) : null}

      {hideFooter ? null : (
        <div
          className={cn(
            "flex flex-wrap items-center gap-2 border-t border-border/40 pt-3",
            footerAlign === "end" ? "justify-end" : "justify-between",
          )}
        >
          <div
            className={cn(
              "flex min-w-0 flex-wrap items-center gap-1.5",
              footerAlign === "end" && "justify-end",
            )}
          >
            {error.detectedInModels.slice(0, 2).map((model) => {
              const modelBadge = getPerceptionModelBadgeMeta(model, modelLookup);

              return (
                <Badge
                  key={model}
                  variant="outline"
                  className="inline-flex max-w-[190px] min-w-0 items-center gap-1 font-normal"
                  title={modelBadge.title}
                >
                  <ModelBadgeIcon model={modelBadge} className="h-3 w-3" />
                  <span className="min-w-0 truncate">{modelBadge.provider}</span>
                  <span className="shrink-0 text-muted-foreground/70">-</span>
                  <span className="min-w-0 truncate text-muted-foreground">
                    {modelBadge.name}
                  </span>
                </Badge>
              );
            })}
            {error.detectedInModels.length > 2 ? (
              <Badge variant="outline" className="font-normal">
                +{error.detectedInModels.length - 2}
              </Badge>
            ) : null}
            {footerMeta ? (
              <span
                className="max-w-full truncate text-[11px] font-medium text-muted-foreground md:max-w-[260px] md:text-xs"
                title={footerMeta}
              >
                {footerMeta}
              </span>
            ) : null}
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {actionStatus ? (
              <Badge
                variant="outline"
                className={cn(
                  "h-6 rounded-sm px-2 text-xs font-bold border-none",
                  statusTone,
                )}
              >
                {formatPerceptionStatusLabelI18n(actionStatus, locale)}
              </Badge>
            ) : null}

            <div
              className={cn(
                "flex h-6 items-center rounded-sm px-2 text-xs font-bold",
                getPerceptionPriorityTone(error.optimizePriority),
              )}
            >
              {formatPerceptionPriorityLabelI18n(error.optimizePriority, locale)}
            </div>

            {shouldShowActionButton ? (
              <Button
                type="button"
                size="sm"
                className="h-7 shrink-0 px-2 text-xs"
                disabled={
                  actionSaving ||
                  markingActionDone ||
                  (actionStatus === "done" && !canRemoveAction) ||
                  (actionGenerated && !canMarkDone && !canRemoveAction)
                }
                onClick={actionButtonHandler}
              >
                {actionButtonLabel}
              </Button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
