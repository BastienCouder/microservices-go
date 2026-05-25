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
} from "@/lib/perception-data";
import { buildProviderLabel } from "@/lib/project-models";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/shared/section-title";
import { buildScopedHref } from "@/shared/selection";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  formatPerceptionErrorTypeLabel as formatPerceptionErrorTypeLabelI18n,
  formatPerceptionPriorityLabel as formatPerceptionPriorityLabelI18n,
  formatPerceptionStatusLabel as formatPerceptionStatusLabelI18n,
  getPerceptionActionStatusTone,
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

export function TopErrorsPanel({
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
  const seeMoreHref = buildScopedHref("/error-hub", {
    project: projectId,
    source: "perception",
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h4>
            <SectionTitle>{t("topErrorsTitle")}</SectionTitle>
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
            label={emptyLabel || `${t("topErrorsEmptyTitle")}.`}
            className="h-[120px] text-sm"
          />
        ) : (
          errors.map((error, index) => (
            <PerceptionTopErrorCard
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
            />
          ))
        )}

        {showSeeMore ? (
          <Button asChild variant="ghost" size="sm" className="w-full text-xs">
            <Link to={seeMoreHref}>{t("topErrorsSeeMore")}</Link>
          </Button>
        ) : null}
      </div>

      {selectedError ? (
        isMobile ? (
          <Drawer
            open={selectedError !== null}
            onOpenChange={handleDetailsOpenChange}
          >
            <DrawerContent className="h-[94vh] rounded-t-[32px] border-none bg-white">
              <DrawerHeader className="sr-only">
                <DrawerTitle>{selectedError.title}</DrawerTitle>
                <DrawerDescription>
                  {t("topErrorsSheetDescription")}
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
                <SheetTitle>{selectedError.title}</SheetTitle>
                <SheetDescription>
                  {t("topErrorsSheetDescription")}
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
      <div className="rounded-2xl border border-slate-100 px-4 py-4 text-sm leading-7 text-foreground/90 [overflow-wrap:anywhere]">
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
  const resolvedGeneratedContent = resolvePerceptionGeneratedContent(
    error.generatedContent,
    error.generatedContentKey,
    locale,
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
      ? t("topErrorsRemove")
      : canMarkDone
        ? t("topErrorsMarkDone")
        : actionGenerated
          ? t("topErrorsAdded")
          : t("topErrorsFix");

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
              {error.title}
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
              {t("topErrorsImpact")}
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
              label={t("topErrorsGeneratedFix")}
              value={formatPerceptionErrorTypeLabelI18n(error.type, locale)}
            />
          </div>

          <ErrorTextBlock label={t("topErrorsAiClaim")}>
            <p>{error.issue}</p>
          </ErrorTextBlock>

          <ErrorTextBlock label={t("topErrorsImpact")}>
            <p>{error.impact}</p>
          </ErrorTextBlock>

          <ErrorTextBlock label={t("topErrorsGeneratedFix")}>
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

function getPriorityDotTone(priority: PerceptionError["optimizePriority"]) {
  if (priority === "high") return "bg-rose-500";
  if (priority === "medium") return "bg-amber-500";
  return "bg-green-500";
}

type PerceptionModelBadgeMeta = {
  iconPath: string;
  name: string;
  provider: string;
  title: string;
};

const PROVIDER_VISUALS = [
  {
    keys: ["openai", "chatgpt", "gpt", "o1", "o3", "o4"],
    provider: "OpenAI",
    iconPath: "/models/openai.svg",
  },
  {
    keys: ["google", "gemini"],
    provider: "Google",
    iconPath: "/models/google.svg",
  },
  {
    keys: ["anthropic", "claude"],
    provider: "Anthropic",
    iconPath: "/models/anthropic.svg",
  },
  {
    keys: ["perplexity"],
    provider: "Perplexity",
    iconPath: "/models/perplexity.svg",
  },
  { keys: ["mistral"], provider: "Mistral", iconPath: "/models/mistral.svg" },
  {
    keys: ["microsoft", "copilot"],
    provider: "Microsoft",
    iconPath: "/models/copilot.svg",
  },
  { keys: ["xai", "grok"], provider: "xAI", iconPath: "/models/xai.svg" },
  {
    keys: ["deepseek"],
    provider: "DeepSeek",
    iconPath: "/models/deepseek.svg",
  },
  { keys: ["qwen"], provider: "Qwen", iconPath: "/models/qwen.svg" },
  { keys: ["meta", "llama"], provider: "Meta", iconPath: "/models/meta.svg" },
  { keys: ["groq"], provider: "Groq", iconPath: "/models/groq.svg" },
  {
    keys: ["openrouter"],
    provider: "OpenRouter",
    iconPath: "/models/openrouter.svg",
  },
  { keys: ["zai"], provider: "Z.ai", iconPath: "/models/zai.svg" },
] as const;

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
  const providerValue = normalizeModelLookupKey(provider);
  const modelValue = normalizeModelLookupKey(modelName);
  const providerMatch = PROVIDER_VISUALS.find(({ keys }) =>
    keys.some((key) => providerValue.includes(key)),
  );
  if (providerMatch) return providerMatch;

  return PROVIDER_VISUALS.find(({ keys }) =>
    keys.some((key) => modelValue.includes(key)),
  );
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
      provider: provider || "AI provider",
      title: `${provider || "AI provider"} - ${name}`,
    };
  }

  const providerVisual = findProviderVisual("", modelName);
  const provider = providerVisual?.provider ?? "AI provider";
  const name = getProviderModelName(modelName) || modelName || "Modele IA";

  return {
    iconPath: providerVisual?.iconPath ?? "",
    name,
    provider,
    title: `${provider} - ${name}`,
  };
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

export function PerceptionTopErrorCard({
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
      ? t("topErrorsRemove")
      : canMarkDone
        ? t("topErrorsMarkDone")
        : actionGenerated
          ? t("topErrorsAdded")
          : t("topErrorsFix");
  const hasMultipleModels = error.detectedInModels.length > 1;
  const resolvedGeneratedContent = resolvePerceptionGeneratedContent(
    error.generatedContent,
    error.generatedContentKey,
    locale,
  );
  const primaryModel = error.detectedInModels[0]
    ? getPerceptionModelBadgeMeta(error.detectedInModels[0], modelLookup)
    : null;

  return (
    <div className="group w-full rounded-md bg-background p-4 text-left transition-all hover:ring-2 hover:ring-primary/20">
      <button
        type="button"
        className="block w-full cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={onOpenDetails}
        aria-label={`${t("topErrorsTitle")}: ${error.title}`}
      >
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            {primaryModel ? (
              <div className="rounded-md border border-border/50 bg-white p-1">
                {hasMultipleModels ? (
                  <span
                    className={cn(
                      "block h-3.5 w-3.5 rounded-full",
                      getPriorityDotTone(error.optimizePriority),
                    )}
                  />
                ) : (
                  <ModelBadgeIcon
                    model={primaryModel}
                    className="h-3.5 w-3.5"
                  />
                )}
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
          {error.title}
        </p>
        <p className="mb-3 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
          {error.issue}
        </p>
        {contextMeta ? (
          <div className="mb-3">
            <Badge
              variant="outline"
              className="inline-flex max-w-full items-center gap-1.5 rounded-md border-border/70 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-foreground"
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
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {actionStatus ? (
            <Badge
              variant="outline"
              className={cn(
                "h-6 rounded-sm px-2 text-xs font-bold",
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
    </div>
  );
}
