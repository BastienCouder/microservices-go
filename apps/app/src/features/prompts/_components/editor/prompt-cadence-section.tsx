"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  CADENCE_DAY_OPTIONS,
  CADENCE_TIME_OPTIONS,
  cronToCadenceBuilder,
  cadenceBuilderToCron,
  PROMPT_TIMEZONE_OPTIONS,
  type CadenceBuilderValue,
} from "../../_lib/prompt-editor";
import type { AIModel, ModelVisual, PromptSchedule } from "../../_lib/types";

export function PromptCadenceSection({
  schedule,
  saving,
  selectedModels,
  getModelVisual,
  cadenceModeLabel,
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
  onSetMode: (mode: PromptSchedule["mode"]) => void;
  onSetCron: (cron: string) => void;
  onSetTimezone: (timezone: string) => void;
  onToggleOverride: (model: AIModel, enabled: boolean) => void;
  onUpdateOverride: (model: AIModel, cron: string) => void;
}) {
  const { t } = useScopedI18n("prompts-workspace");
  const overridesCount = Object.keys(schedule.modelCrons).length;
  const [globalBuilder, setGlobalBuilder] = useState<CadenceBuilderValue>(() =>
    cronToCadenceBuilder(schedule.cron),
  );
  const overrideBuilders = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(schedule.modelCrons).map(([model, cron]) => [model, cronToCadenceBuilder(cron)]),
      ),
    [schedule.modelCrons],
  );

  useEffect(() => {
    setGlobalBuilder(cronToCadenceBuilder(schedule.cron));
  }, [schedule.cron]);

  const updateGlobalBuilder = (updater: (current: CadenceBuilderValue) => CadenceBuilderValue) => {
    setGlobalBuilder((current) => {
      const next = updater(current);
      onSetCron(cadenceBuilderToCron(next));
      return next;
    });
  };

  const updateOverrideBuilder = (
    model: AIModel,
    updater: (current: CadenceBuilderValue) => CadenceBuilderValue,
  ) => {
    const current = overrideBuilders[model] ?? cronToCadenceBuilder(schedule.modelCrons[model] || "");
    const next = updater(current);
    onUpdateOverride(model, cadenceBuilderToCron(next));
  };

  return (
    <section className="rounded-xl bg-background p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-sm font-medium">{t("editorCadenceTitle")}</div>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="text-right font-medium">{cadenceModeLabel}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <ModeCard
          title={t("editorCadenceModeGlobalTitle")}
          active={schedule.mode === "global"}
          onClick={() => onSetMode("global")}
        />
        <ModeCard
          title={t("editorCadenceModePerAiTitle")}
          active={schedule.mode === "per_model"}
          onClick={() => onSetMode("per_model")}
        />
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-3">
          <CadenceBuilderFields
            scope="global"
            value={globalBuilder}
            saving={saving}
            t={t}
            onChange={updateGlobalBuilder}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-timezone">{t("timezone")}</Label>
          <Select value={schedule.timezone} onValueChange={onSetTimezone} disabled={saving}>
            <SelectTrigger id="prompt-timezone" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PROMPT_TIMEZONE_OPTIONS.map((timezone) => (
                <SelectItem key={timezone.value} value={timezone.value}>
                  {t(timezone.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {schedule.mode === "per_model" ? (
        <div className="mt-5 space-y-3">
          <div className="text-sm font-medium">{t("perAiCustomCadencesTitle")}</div>
          <div className="space-y-3">
            {selectedModels.map((model) => {
              const visual = getModelVisual(model);
              const overrideCron = schedule.modelCrons[model] || "";
              const hasOverride = overrideCron !== "";
              const overrideBuilder = overrideBuilders[model] ?? cronToCadenceBuilder(overrideCron);

              return (
                <div key={model} className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      <img src={visual.icon} alt={visual.name} className="h-5 w-5 object-contain" decoding="async" />
                      <div className="min-w-0">
                        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                          {visual.provider}
                        </div>
                        <div className="text-sm font-semibold break-words [overflow-wrap:anywhere]">{visual.name}</div>
                      </div>
                    </div>
                    {hasOverride ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={saving}
                        onClick={() => onToggleOverride(model, false)}
                      >
                        {t("revertToGlobalCadence")}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={saving}
                        onClick={() => onToggleOverride(model, true)}
                      >
                        {t("setCustomCadence")}
                      </Button>
                    )}
                  </div>

                  {hasOverride ? (
                    <div className="mt-4 space-y-3">
                      <CadenceBuilderFields
                        scope={`override-${model}`}
                        value={overrideBuilder}
                        saving={saving}
                        t={t}
                        onChange={(updater) => updateOverrideBuilder(model, updater)}
                      />
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

function CadenceBuilderFields({
  scope,
  value,
  saving,
  t,
  onChange,
}: {
  scope: string;
  value: CadenceBuilderValue;
  saving: boolean;
  t: (key: string, options?: Record<string, unknown>) => string;
  onChange: (updater: (current: CadenceBuilderValue) => CadenceBuilderValue) => void;
}) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const simpleKind = value.kind === "custom" ? "selected_days" : value.kind;

  if (advancedOpen) {
    return (
      <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium">{t("cadenceAdvancedTitle")}</div>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={saving}
            onClick={() => {
              onChange(() => ({
                kind: "daily",
                time: "09:00",
                selectedDays: ["1", "4"],
                customCron: "0 9 * * *",
              }));
              setAdvancedOpen(false);
            }}
          >
            {t("cadenceBackToSimple")}
          </Button>
        </div>

        <div className="mt-4 space-y-2">
          <Label htmlFor={`${scope}-custom-cron`}>{t("customCronRule")}</Label>
          <Input
            id={`${scope}-custom-cron`}
            value={value.customCron}
            onChange={(event) =>
              onChange((current) => ({ ...current, customCron: event.target.value, kind: "custom" }))
            }
            placeholder="0 9 * * *"
            disabled={saving}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-muted/10 p-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_160px]">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-medium">{t("cadencePatternLabel")}</div>
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <PatternCard
              title={t("cadenceEveryDayShort")}
              active={simpleKind === "daily"}
              onClick={() => onChange((current) => ({ ...current, kind: "daily" }))}
            />
            <PatternCard
              title={t("cadenceEveryTwoDaysShort")}
              active={simpleKind === "every_two_days"}
              onClick={() => onChange((current) => ({ ...current, kind: "every_two_days" }))}
            />
            <PatternCard
              title={t("cadenceSelectedDaysLabel")}
              active={simpleKind === "selected_days"}
              onClick={() =>
                onChange((current) => ({
                  ...current,
                  kind: "selected_days",
                  selectedDays: current.selectedDays.length > 0 ? current.selectedDays : ["1"],
                }))
              }
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${scope}-time`}>{t("cadenceTimeLabel")}</Label>
          <Select
            value={value.time}
            onValueChange={(nextTime) => onChange((current) => ({ ...current, time: nextTime }))}
            disabled={saving}
          >
            <SelectTrigger id={`${scope}-time`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CADENCE_TIME_OPTIONS.map((time) => (
                <SelectItem key={time} value={time}>
                  {time}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {simpleKind === "selected_days" ? (
        <div className="mt-4 space-y-2">
          <div className="text-sm font-medium">{t("cadenceDaysLabel")}</div>
          <div className="flex flex-wrap gap-2">
            {CADENCE_DAY_OPTIONS.map((day) => {
              const selected = value.selectedDays.includes(day.value);
              return (
                <button
                  key={`${scope}-${day.value}`}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    onChange((current) => {
                      const isSelected = current.selectedDays.includes(day.value);
                      const nextSelectedDays = isSelected
                        ? current.selectedDays.filter((item) => item !== day.value)
                        : [...current.selectedDays, day.value];
                      return {
                        ...current,
                        selectedDays: nextSelectedDays.length > 0 ? nextSelectedDays : ["1"],
                      };
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
                  )}
                >
                  {t(day.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={saving}
          onClick={() => setAdvancedOpen(true)}
        >
          {t("cadenceAdvancedToggle")}
        </Button>
      </div>
    </div>
  );
}

function PatternCard({
  title,
  active,
  onClick,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-2xl border px-4 py-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
      )}
    >
      <div className="text-sm font-medium">{title}</div>
    </button>
  );
}

function ModeCard({
  title,
  active,
  onClick,
}: {
  title: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/5"
          : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
      )}
    >
      <div className="text-sm font-medium">{title}</div>
    </button>
  );
}
