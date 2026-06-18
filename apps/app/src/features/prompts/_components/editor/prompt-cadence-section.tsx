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

      <div className="mt-4 inline-flex h-10 max-w-full gap-1 rounded-xl border p-1">
        <Button
          type="button"
          size="sm"
          variant={schedule.mode === "global" ? "default" : "ghost"}
          className="h-8 rounded-lg px-3 text-sm"
          disabled={saving}
          onClick={() => onSetMode("global")}
        >
          {t("editorCadenceModeGlobalTitle")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant={schedule.mode === "per_model" ? "default" : "ghost"}
          className="h-8 rounded-lg px-3 text-sm"
          disabled={saving}
          onClick={() => onSetMode("per_model")}
        >
          {t("editorCadenceModePerAiTitle")}
        </Button>
      </div>

      <div className="mt-5 space-y-4">
        <CadenceBuilderFields
          scope="global"
          value={globalBuilder}
          saving={saving}
          t={t}
          onChange={updateGlobalBuilder}
        />

        <div className="max-w-sm space-y-2">
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
                <div key={model} className="rounded-lg border border-border/70 bg-muted/10 px-4 py-4">
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
      <div className="rounded-lg border border-border/70 bg-muted/10 p-4">
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
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(180px,1fr)_minmax(150px,180px)_minmax(260px,1.15fr)]">
        <div className="space-y-2">
          <Label htmlFor={`${scope}-frequency`}>{t("cadenceFrequencyLabel")}</Label>
          <Select
            value={simpleKind}
            onValueChange={(nextKind) =>
              onChange((current) => ({
                ...current,
                kind: nextKind as CadenceBuilderValue["kind"],
                selectedDays: nextKind === "selected_days" && current.selectedDays.length === 0
                  ? ["1"]
                  : current.selectedDays,
              }))
            }
            disabled={saving}
          >
            <SelectTrigger id={`${scope}-frequency`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="daily">{t("cadenceEveryDayShort")}</SelectItem>
              <SelectItem value="every_two_days">{t("cadenceEveryTwoDaysShort")}</SelectItem>
              <SelectItem value="selected_days">{t("cadenceSelectedDaysLabel")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor={`${scope}-time`}>{t("cadenceTimeLabel")}</Label>
          <Input
            id={`${scope}-time`}
            type="time"
            value={value.time}
            step={1800}
            onChange={(event) => onChange((current) => ({ ...current, time: event.target.value || "09:00" }))}
            disabled={saving}
            className="h-8 text-sm"
          />
        </div>

        <div className={cn("space-y-2", simpleKind !== "selected_days" && "opacity-45")}>
          <Label>{t("cadenceDaysLabel")}</Label>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-4 xl:grid-cols-7">
            {CADENCE_DAY_OPTIONS.map((day) => {
              const selected = value.selectedDays.includes(day.value);
              return (
                <button
                  key={`${scope}-${day.value}`}
                  type="button"
                  disabled={saving}
                  onClick={() =>
                    onChange((current) => {
                      if (simpleKind !== "selected_days") {
                        return {
                          ...current,
                          kind: "selected_days",
                          selectedDays: [day.value],
                        };
                      }
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
                    "h-9 rounded-md border px-2 text-sm font-medium transition-colors",
                    selected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
                  )}
                >
                  {t(day.labelKey)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

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
