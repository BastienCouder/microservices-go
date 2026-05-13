"use client";

import { type ReactNode, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { PerceptionError, PerceptionModelOption } from "@/lib/perception-data";
import { buildProviderLabel } from "@/lib/project-models";
import { cn } from "@/lib/utils";
import { SectionTitle } from "@/components/shared/section-title";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { useIsMobile } from "@/shared/hooks/use-mobile";
import {
  formatPerceptionErrorTypeLabel as formatPerceptionErrorTypeLabelI18n,
  formatPerceptionPriorityLabel as formatPerceptionPriorityLabelI18n,
  getPerceptionSeverityLabel,
} from "../_lib";

export function TopErrorsPanel({
  errors,
  generatedIds,
  modelCatalog,
  onCreateAction,
  savingErrorIds,
  showSeeMore = true,
}: {
  errors: PerceptionError[];
  generatedIds?: ReadonlySet<string>;
  modelCatalog?: PerceptionModelOption[];
  onCreateAction?: (error: PerceptionError) => void | Promise<void>;
  savingErrorIds?: ReadonlySet<string>;
  showSeeMore?: boolean;
}) {
  const { locale, t } = useScopedI18n("perception");
  const [selectedError, setSelectedError] = useState<PerceptionError | null>(null);
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
  const selectedActionGenerated = selectedError ? (generatedIds?.has(selectedError.id) ?? false) : false;
  const selectedActionSaving = selectedError ? (savingErrorIds?.has(selectedError.id) ?? false) : false;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="min-w-0">
          <h4>
            <SectionTitle>{t("topErrorsTitle")}</SectionTitle>
          </h4>
        </div>
        <Badge variant="secondary" className="h-5 bg-primary/10 px-1.5 font-mono text-[10px] text-primary">
          {errors.length}
        </Badge>
      </div>

      <div className="space-y-3">
        {errors.length === 0 ? (
          <div className="rounded-md bg-background p-4 text-center">
            <p className="text-sm font-medium text-foreground">{t("topErrorsEmptyTitle")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("topErrorsEmptyDescription")}
            </p>
          </div>
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
              onCreateAction={onCreateAction ? () => void onCreateAction(error) : undefined}
            />
          ))
        )}

        {showSeeMore ? (
          <Button asChild variant="ghost" size="sm" className="w-full text-xs">
            <Link to="/optimize/actions">{t("topErrorsSeeMore")}</Link>
          </Button>
        ) : null}
      </div>

      {selectedError ? (
        isMobile ? (
          <Drawer open={selectedError !== null} onOpenChange={handleDetailsOpenChange}>
            <DrawerContent className="h-[94vh] rounded-t-[32px] border-none bg-white">
              <DrawerHeader className="sr-only">
                <DrawerTitle>{selectedError.title}</DrawerTitle>
                <DrawerDescription>{t("topErrorsSheetDescription")}</DrawerDescription>
              </DrawerHeader>
              <ErrorDetailsContent
                error={selectedError}
                locale={locale}
                modelLookup={modelLookup}
                mobile
                actionGenerated={selectedActionGenerated}
                actionSaving={selectedActionSaving}
                onCreateAction={onCreateAction ? () => void onCreateAction(selectedError) : undefined}
              />
            </DrawerContent>
          </Drawer>
        ) : (
          <Sheet open={selectedError !== null} onOpenChange={handleDetailsOpenChange}>
            <SheetContent side="right" className="!max-w-2xl">
              <SheetHeader className="sr-only">
                <SheetTitle>{selectedError.title}</SheetTitle>
                <SheetDescription>{t("topErrorsSheetDescription")}</SheetDescription>
              </SheetHeader>
              <ErrorDetailsContent
                error={selectedError}
                locale={locale}
                modelLookup={modelLookup}
                mobile={false}
                actionGenerated={selectedActionGenerated}
                actionSaving={selectedActionSaving}
                onCreateAction={onCreateAction ? () => void onCreateAction(selectedError) : undefined}
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
      <span className="min-w-0 text-right text-sm font-semibold [overflow-wrap:anywhere]">{value}</span>
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
      <div className="text-xs font-bold tracking-widest text-primary">{label}</div>
      <div className="rounded-2xl border border-slate-100 px-4 py-4 text-sm leading-7 text-foreground/90 [overflow-wrap:anywhere]">
        {children}
      </div>
    </div>
  );
}

function ErrorDetailsContent({
  actionGenerated = false,
  actionSaving = false,
  error,
  locale,
  modelLookup,
  mobile,
  onCreateAction,
}: {
  actionGenerated?: boolean;
  actionSaving?: boolean;
  error: PerceptionError;
  locale: string;
  modelLookup: ReadonlyMap<string, PerceptionModelOption>;
  mobile: boolean;
  onCreateAction?: () => void;
}) {
  const { t } = useScopedI18n("perception");
  const severity = getSeverityTone(error.severity, locale);

  return (
    <div className={cn("flex h-full flex-col bg-white font-sans antialiased", mobile && "overflow-y-auto")}>
      <div className={cn("px-8 pt-10", mobile && "px-6 pt-6")}>
        <div className="mb-10 flex flex-col items-start justify-between gap-4">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className={cn("text-sm", severity.label)}>
                {severity.tag}
              </Badge>
              <Badge variant={error.optimizePriority === "high" ? "destructive" : "secondary"} className="text-sm">
                {formatPerceptionPriorityLabelI18n(error.optimizePriority, locale)}
              </Badge>
              {error.detectedInModels.map((model) => {
                const modelBadge = getPerceptionModelBadgeMeta(model, modelLookup);

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

            {onCreateAction ? (
              <Button
                type="button"
                size="sm"
                className="w-fit"
                disabled={actionGenerated || actionSaving}
                onClick={onCreateAction}
              >
                {actionGenerated ? t("topErrorsAdded") : t("topErrorsFix")}
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
            <span className={cn("text-4xl font-extralight tracking-tighter md:text-6xl", severity.label)}>
              {severity.tag}
            </span>
          </div>

          <div className="space-y-7">
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
            <p>{error.generatedContent}</p>
          </ErrorTextBlock>
        </div>
      </div>
    </div>
  );
}

function getSeverityTone(severity: PerceptionError["severity"], locale: string) {
  if (severity === "high") {
    return { dot: "bg-rose-500", label: "text-rose-500", tag: getPerceptionSeverityLabel("high", locale) };
  }
  if (severity === "medium") {
    return { dot: "bg-amber-500", label: "text-amber-600", tag: getPerceptionSeverityLabel("medium", locale) };
  }
  return { dot: "bg-sky-500", label: "text-sky-600", tag: getPerceptionSeverityLabel("low", locale) };
}

type PerceptionModelBadgeMeta = {
  iconPath: string;
  name: string;
  provider: string;
  title: string;
};

const PROVIDER_VISUALS = [
  { keys: ["openai", "chatgpt", "gpt", "o1", "o3", "o4"], provider: "OpenAI", iconPath: "/models/openai.svg" },
  { keys: ["google", "gemini"], provider: "Google", iconPath: "/models/google.svg" },
  { keys: ["anthropic", "claude"], provider: "Anthropic", iconPath: "/models/anthropic.svg" },
  { keys: ["perplexity"], provider: "Perplexity", iconPath: "/models/perplexity.svg" },
  { keys: ["mistral"], provider: "Mistral", iconPath: "/models/mistral.svg" },
  { keys: ["microsoft", "copilot"], provider: "Microsoft", iconPath: "/models/copilot.svg" },
  { keys: ["xai", "grok"], provider: "xAI", iconPath: "/models/xai.svg" },
  { keys: ["deepseek"], provider: "DeepSeek", iconPath: "/models/deepseek.svg" },
  { keys: ["qwen"], provider: "Qwen", iconPath: "/models/qwen.svg" },
  { keys: ["meta", "llama"], provider: "Meta", iconPath: "/models/meta.svg" },
  { keys: ["groq"], provider: "Groq", iconPath: "/models/groq.svg" },
  { keys: ["openrouter"], provider: "OpenRouter", iconPath: "/models/openrouter.svg" },
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
  const parts = providerModelId.split("/").map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) ?? providerModelId.trim();
}

function getPerceptionModelBadgeMeta(
  modelName: string,
  modelLookup: ReadonlyMap<string, PerceptionModelOption>,
): PerceptionModelBadgeMeta {
  const model = modelLookup.get(normalizeModelLookupKey(modelName));

  if (model) {
    const providerVisual = findProviderVisual(model.provider, model.providerModelId || model.displayName);
    const provider = providerVisual?.provider ?? buildProviderLabel(model.provider);
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
    return <span className={cn("shrink-0 rounded-full bg-muted-foreground/40", className)} />;
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
  error,
  index,
  showIndex = true,
  modelLookup = new Map(),
  onOpenDetails,
  onCreateAction,
  locale,
}: {
  actionGenerated?: boolean;
  actionSaving?: boolean;
  error: PerceptionError;
  index: number;
  showIndex?: boolean;
  modelLookup?: ReadonlyMap<string, PerceptionModelOption>;
  onOpenDetails: () => void;
  onCreateAction?: () => void;
  locale: string;
}) {
  const { t } = useScopedI18n("perception");
  const tone = getSeverityTone(error.severity, locale);
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
                <ModelBadgeIcon model={primaryModel} className="h-3.5 w-3.5" />
              </div>
            ) : (
              <div className={cn("h-3.5 w-3.5 rounded-full", tone.dot)} />
            )}

            <div className="min-w-0">
              <p className={cn("truncate text-xs font-semibold md:text-sm", tone.label)}>
                {tone.tag}
              </p>
              <p className="truncate text-[11px] text-muted-foreground md:text-xs">
                {formatPerceptionErrorTypeLabelI18n(error.type, locale)}
              </p>
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
      </button>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
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
          <div
            className={cn(
              "flex h-6 items-center rounded-sm px-2 text-xs font-bold",
              error.optimizePriority === "high"
                ? "bg-destructive/10 text-destructive"
                : error.optimizePriority === "medium"
                  ? "bg-amber-500/10 text-amber-700"
                  : "bg-green-500/10 text-green-700",
            )}
          >
            {formatPerceptionPriorityLabelI18n(error.optimizePriority, locale)}
          </div>

          {onCreateAction ? (
            <Button
              type="button"
              size="sm"
              className="h-7 shrink-0 px-2 text-xs"
              disabled={actionGenerated || actionSaving}
              onClick={onCreateAction}
            >
              {actionGenerated ? t("topErrorsAdded") : t("topErrorsFix")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
