"use client";

import type { ReactNode } from "react";
import { Bot, Globe2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { GLOBAL_CADENCE_PRESETS } from "../../_lib/prompt-editor";
import { promptScheduleLabel } from "../../_lib/utils";
import type { AIModel, ModelVisual, PromptSchedule } from "../../_lib/types";

export function PromptCadenceSection({
  schedule,
  saving,
  selectedModels,
  getModelVisual,
  cadenceModeLabel,
  scheduleLabel,
  onSetMode,
  onSetCron,
  onSetTimezone,
  onToggleOverride,
  onUpdateOverride,
}: {
  schedule: PromptSchedule;
  saving: boolean;
  selectedModels: AIModel[];
  getModelVisual: (model: string) => ModelVisual;
  cadenceModeLabel: string;
  scheduleLabel: string;
  onSetMode: (mode: PromptSchedule["mode"]) => void;
  onSetCron: (cron: string) => void;
  onSetTimezone: (timezone: string) => void;
  onToggleOverride: (model: AIModel, enabled: boolean) => void;
  onUpdateOverride: (model: AIModel, cron: string) => void;
}) {
  const { locale, t } = useScopedI18n("prompts-workspace");
  const overridesCount = Object.keys(schedule.modelCrons).length;

  return (
    <section className="rounded-3xl bg-background p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <div className="text-sm font-medium">{t("editorCadenceTitle")}</div>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {t("editorCadenceDescription")}
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="text-right font-medium">{cadenceModeLabel}</span>
          {schedule.mode === "global" ? (
            <>
              -<span className="text-right font-medium">{scheduleLabel}</span>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ModeCard title={t("editorCadenceModeGlobalTitle")} description={t("editorCadenceModeGlobalDescription")} active={schedule.mode === "global"} icon={<Globe2 className="h-4 w-4" />} onClick={() => onSetMode("global")} />
        <ModeCard title={t("editorCadenceModePerAiTitle")} description={t("editorCadenceModePerAiDescription")} active={schedule.mode === "per_model"} icon={<Bot className="h-4 w-4" />} onClick={() => onSetMode("per_model")} />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {t("quickPresets")}
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {GLOBAL_CADENCE_PRESETS.map((preset) => {
              const active = schedule.cron === preset.cron;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onSetCron(preset.cron)}
                  className={cn(
                    "cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/5"
                      : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
                  )}
                >
                  <div className="text-sm font-medium">{t(preset.labelKey)}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="prompt-timezone">{t("timezone")}</Label>
            <Input
              id="prompt-timezone"
              value={schedule.timezone}
              onChange={(event) => onSetTimezone(event.target.value)}
              placeholder="UTC"
              disabled={saving}
              className="max-w-full [overflow-wrap:anywhere]"
            />
          </div>
        </div>
      </div>

      {schedule.mode === "per_model" ? (
        <div className="mt-5 space-y-3">
          <div className="text-sm font-medium">{t("perAiCustomCadencesTitle")}</div>
          <p className="text-sm leading-6 text-muted-foreground">
            {t("perAiCustomCadencesDescription")}
          </p>
          <div className="space-y-3">
            {selectedModels.map((model) => {
              const visual = getModelVisual(model);
              const overrideCron = schedule.modelCrons[model] || "";
              const hasOverride = overrideCron !== "";
              const currentCadenceLabel = hasOverride
                ? promptScheduleLabel(schedule, overrideCron, locale)
                : `${promptScheduleLabel(schedule, undefined, locale)} (${t("globalCadenceSuffix")})`;

              return (
                <div key={model} className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <img src={visual.icon} alt={visual.name} className="h-5 w-5 object-contain" decoding="async" />
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {visual.provider}
                        </div>
                        <div className="text-sm font-semibold break-words [overflow-wrap:anywhere]">{visual.name}</div>
                      </div>
                    </div>
                    {hasOverride ? (
                      <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={saving} onClick={() => onToggleOverride(model, false)}>
                        {t("revertToGlobalCadence")}
                      </Button>
                    ) : (
                      <Button type="button" size="sm" variant="outline" className="rounded-full" disabled={saving} onClick={() => onToggleOverride(model, true)}>
                        {t("setCustomCadence")}
                      </Button>
                    )}
                  </div>

                  <div className="mt-3 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                    {t("currentCadence", { label: currentCadenceLabel })}
                  </div>

                  {hasOverride ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {GLOBAL_CADENCE_PRESETS.map((preset) => (
                        <Button
                          key={`${model}-${preset.id}`}
                          type="button"
                          size="sm"
                          variant={overrideCron === preset.cron ? "default" : "outline"}
                          className="rounded-full"
                          disabled={saving}
                          onClick={() => onUpdateOverride(model, preset.cron)}
                        >
                          {t(preset.labelKey)}
                        </Button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <div className="text-xs text-muted-foreground">
            {overridesCount === 0
              ? t("noCustomCadence")
              : t("customCadenceCount", { count: overridesCount })}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function ModeCard({
  title,
  description,
  active,
  icon,
  onClick,
}: {
  title: string;
  description: string;
  active: boolean;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
      )}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">{icon}</div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
    </button>
  );
}
