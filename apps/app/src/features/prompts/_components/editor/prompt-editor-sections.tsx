"use client";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  PROMPT_STATUS_OPTIONS,
  getPromptStatusLabel,
} from "../../_lib/prompt-editor";
import type { AIModel, ModelVisual, PromptItem } from "../../_lib/types";

export function PromptTextSection({
  promptText,
  maxLength,
  status,
  saving,
  onChangePromptText,
  onChangeStatus,
}: {
  promptText: string;
  maxLength: number;
  status: PromptItem["status"];
  saving: boolean;
  onChangePromptText: (value: string) => void;
  onChangeStatus: (value: PromptItem["status"]) => void;
}) {
  const { locale, t } = useScopedI18n("prompts-workspace");

  return (
    <section className="rounded-3xl rounded-tr-none bg-background p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("editorPromptTitle")}</div>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("editorPromptDescription")}
          </p>
        </div>
        <div className="text-xs text-muted-foreground">
          {promptText.length} / {maxLength}
        </div>
      </div>

      <Textarea
        value={promptText}
        onChange={(event) => onChangePromptText(event.target.value.slice(0, maxLength))}
        maxLength={maxLength}
        placeholder={t("editorPromptPlaceholder")}
        className="mt-4 min-h-[220px] w-full max-w-full resize-y overflow-x-hidden text-sm leading-7 break-all [overflow-wrap:anywhere]"
      />

      <div className="mt-5 border-t pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="text-sm font-medium">{t("editorStatusTitle")}</div>
          <Badge variant="outline">{getPromptStatusLabel(status, locale)}</Badge>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {PROMPT_STATUS_OPTIONS.map((option) => {
            const selected = status === option.value;

            return (
              <button
                key={option.value}
                type="button"
                disabled={saving}
                onClick={() => onChangeStatus(option.value)}
                aria-pressed={selected}
                className={cn(
                  "relative flex w-full cursor-pointer flex-col gap-2 rounded-2xl border px-4 py-4 text-left transition-colors",
                  selected
                    ? "border-primary bg-primary/5"
                    : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
                )}
              >
                <div className="absolute right-3 top-3">
                  <div
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                      selected
                        ? "border-primary bg-primary/80 text-primary"
                        : "border-border bg-background/70 text-muted-foreground",
                    )}
                  />
                </div>
                <div className="pr-5 text-sm font-semibold">
                  {getPromptStatusLabel(option.value, locale)}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function PromptCoverageSection({
  availableModels,
  selectedModels,
  getModelVisual,
  saving,
  onToggleModel,
}: {
  availableModels: AIModel[];
  selectedModels: AIModel[];
  getModelVisual: (model: string) => ModelVisual;
  saving: boolean;
  onToggleModel: (model: AIModel) => void;
}) {
  const { t } = useScopedI18n("prompts-workspace");

  return (
    <section className="rounded-3xl bg-background p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("editorCoverageTitle")}</div>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("editorCoverageDescription")}
          </p>
        </div>
        <Badge variant="outline">{t("editorCoverageCount", { count: selectedModels.length })}</Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {availableModels.map((model) => {
          const visual = getModelVisual(model);
          const selected = selectedModels.includes(model);

          return (
            <button
              key={model}
              type="button"
              disabled={saving}
              onClick={() => onToggleModel(model)}
              aria-pressed={selected}
              className={cn(
                "relative flex w-full cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                selected
                  ? "border-primary bg-primary/5"
                  : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
              )}
            >
              <div className="absolute right-3 top-3">
                <div
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded-full border transition-colors",
                    selected
                      ? "border-primary bg-primary/80 text-primary"
                      : "border-border bg-background/70 text-muted-foreground",
                  )}
                />
              </div>

              <img src={visual.icon} alt={visual.name} className="mt-0.5 h-4 w-4 object-contain" decoding="async" />

              <div className="min-w-0 pr-5">
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  {visual.provider}
                </div>
                <div className="truncate text-sm font-semibold leading-6">{visual.name}</div>
                {visual.label !== visual.name ? (
                  <div className="truncate text-xs text-muted-foreground">{visual.label}</div>
                ) : null}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
