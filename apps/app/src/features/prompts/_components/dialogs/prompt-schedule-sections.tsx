"use client";

import type { ReactNode } from "react";
import { Bot, Clock3, Globe2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { GLOBAL_PRESETS, MODEL_PRESETS } from "../../_lib/prompt-schedule";
import { describeCron, promptScheduleLabel } from "../../_lib/utils";
import type { PromptScheduleVisual } from "../../_lib/prompt-schedule";
import type { PromptSchedule } from "../../_lib/types";

export function PromptScheduleHeader({
  draft,
  promptLabel,
  overridesCount,
  overridesLabel,
}: {
  draft: PromptSchedule;
  promptLabel: string;
  overridesCount: number;
  overridesLabel: string;
}) {
  const { locale, t } = useScopedI18n("prompts-workspace");

  return (
    <div className="border-b bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%)] px-6 py-5">
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
            {t("scheduleBadgeTitle")}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {overridesLabel}
          </Badge>
          <Badge variant="outline" className="rounded-full">
            {draft.timezone || "UTC"}
          </Badge>
        </div>
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <div className="text-xl font-semibold">{t("scheduleCustomizeTitle")}</div>
            <div className="max-w-2xl line-clamp-2 text-sm text-muted-foreground">{promptLabel}</div>
          </div>
          <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm shadow-sm md:max-w-sm">
            <div className="flex items-center gap-2 font-medium">
              <Clock3 className="h-4 w-4 text-primary" />
              {promptScheduleLabel(draft, undefined, locale)}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              {draft.mode === "global"
                ? t("scheduleHeaderGlobalDescription")
                : t("scheduleHeaderPerAiDescription", { count: overridesCount })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PromptScheduleSidebar({
  draft,
  overridesCount,
  onSetMode,
}: {
  draft: PromptSchedule;
  overridesCount: number;
  onSetMode: (mode: PromptSchedule["mode"]) => void;
}) {
  const { locale, t } = useScopedI18n("prompts-workspace");

  return (
    <section className="min-w-0 space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-4">
      <div className="space-y-2">
        <div className="text-sm font-medium">{t("scheduleScopeTitle")}</div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t("scheduleScopeDescription")}
        </p>
      </div>

      <div className="grid gap-2">
        <ScopeCard title={t("scheduleScopeGlobalTitle")} description={t("scheduleScopeGlobalDescription")} active={draft.mode === "global"} icon={<Globe2 className="h-4 w-4" />} onClick={() => onSetMode("global")} />
        <ScopeCard title={t("scheduleScopePerAiTitle")} description={t("scheduleScopePerAiDescription")} active={draft.mode === "per_model"} icon={<Bot className="h-4 w-4" />} onClick={() => onSetMode("per_model")} />
      </div>

      <Separator />

      <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">{t("scheduleCurrentResultTitle")}</div>
        <div className="mt-2 text-sm font-semibold">{promptScheduleLabel(draft, undefined, locale)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {draft.mode === "global"
            ? t("scheduleCurrentResultGlobalDescription")
            : t("scheduleCurrentResultPerAiDescription", { count: overridesCount })}
        </div>
      </div>
    </section>
  );
}

export function PromptScheduleBody({
  draft,
  saving,
  showAdvancedCron,
  validGlobalCron,
  visibleModels,
  onSetCron,
  onSetTimezone,
  onToggleAdvanced,
  onToggleOverride,
  onUpdateOverride,
}: {
  draft: PromptSchedule;
  saving: boolean;
  showAdvancedCron: boolean;
  validGlobalCron: boolean;
  visibleModels: PromptScheduleVisual[];
  onSetCron: (cron: string) => void;
  onSetTimezone: (timezone: string) => void;
  onToggleAdvanced: (value: boolean) => void;
  onToggleOverride: (modelId: string, enabled: boolean) => void;
  onUpdateOverride: (modelId: string, cron: string) => void;
}) {
  const { locale, t } = useScopedI18n("prompts-workspace");

  return (
    <section className="min-w-0 space-y-5 rounded-3xl border border-border/70 bg-background p-4 shadow-sm">
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" />
          {t("scheduleQuickPresetsTitle")}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {t("scheduleQuickPresetsDescription")}
        </p>
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        {GLOBAL_PRESETS.map((preset) => {
          const active = draft.cron === preset.cron;
          return (
            <button
              key={preset.id}
              type="button"
              onClick={() => onSetCron(preset.cron)}
              className={cn(
                "rounded-2xl border px-4 py-3 text-left transition-colors",
                active
                  ? "border-primary bg-primary/8 shadow-sm"
                  : "border-border/70 bg-background hover:border-primary/40 hover:bg-primary/5",
              )}
            >
              <div className="text-sm font-medium">{t(preset.labelKey)}</div>
              <div className="mt-1 text-xs text-muted-foreground">{t(preset.noteKey)}</div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
        <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
          <div className="text-sm font-medium">{describeCron(draft.cron, locale)}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {draft.mode === "global"
              ? t("scheduleMainCadenceDescription")
              : t("scheduleSharedFallbackDescription")}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="prompt-timezone">{t("timezoneLabel")}</Label>
          <Input
            id="prompt-timezone"
            value={draft.timezone}
            onChange={(event) => onSetTimezone(event.target.value)}
            placeholder="UTC"
            disabled={saving}
          />
        </div>
      </div>

      <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">{t("advancedCustomRuleTitle")}</div>
            <div className="mt-1 text-xs text-muted-foreground">{t("advancedCustomRuleDescription")}</div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">{t("manualCron")}</Label>
            <Switch checked={showAdvancedCron} onCheckedChange={onToggleAdvanced} disabled={saving} />
          </div>
        </div>

        {showAdvancedCron ? (
          <div className="mt-4 space-y-2">
            <Label htmlFor="global-cron">{t("globalCronRule")}</Label>
            <Input
              id="global-cron"
              value={draft.cron}
              onChange={(event) => onSetCron(event.target.value)}
              placeholder="0 */6 * * *"
              className={cn(!validGlobalCron && "border-destructive focus-visible:ring-destructive/20")}
              disabled={saving}
            />
            {!validGlobalCron ? (
              <div className="text-xs text-destructive">{t("cronHelp")}</div>
            ) : (
              <div className="text-xs text-muted-foreground">
                {t("humanLabel", { label: describeCron(draft.cron, locale) })}
              </div>
            )}
          </div>
        ) : null}
      </div>

      {draft.mode === "global" ? (
        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-4">
          <div className="text-sm font-medium">{t("scheduleGlobalModeTitle")}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {t("scheduleGlobalModeDescription")}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-4">
            <div className="text-sm font-medium">{t("schedulePerAiOverridesTitle")}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {t("schedulePerAiOverridesDescription")}
            </div>
          </div>

          <ScrollArea className="h-[320px] pr-4">
            <div className="space-y-3">
              {visibleModels.map(({ model, visual, overrideCron, hasOverride, validOverride }) => (
                <div key={model} className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/30">
                        <img src={visual.icon} alt={visual.label} className="h-5 w-5 object-contain" decoding="async" />
                      </div>
                      <div>
                        <div className="font-medium">{visual.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {hasOverride
                            ? promptScheduleLabel(draft, overrideCron, locale)
                            : t("usesGlobalCadence", {
                                label: promptScheduleLabel(draft, undefined, locale),
                              })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="rounded-full">
                        {hasOverride ? t("customOverride") : t("globalFallback")}
                      </Badge>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">{t("override")}</Label>
                        <Switch checked={hasOverride} onCheckedChange={(checked) => onToggleOverride(model, checked)} disabled={saving} />
                      </div>
                    </div>
                  </div>

                  {hasOverride ? (
                    <div className="mt-4 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {MODEL_PRESETS.map((preset) => (
                          <Button
                            key={`${model}-${preset.id}`}
                            type="button"
                            size="sm"
                            variant={overrideCron === preset.cron ? "default" : "outline"}
                            className="rounded-full"
                            onClick={() => onUpdateOverride(model, preset.cron)}
                          disabled={saving}
                        >
                          {t(preset.labelKey)}
                        </Button>
                      ))}
                    </div>

                      {showAdvancedCron ? (
                        <div className="space-y-2">
                          <Label htmlFor={`override-${model}`}>{t("customCronRule")}</Label>
                          <Input
                            id={`override-${model}`}
                            value={overrideCron}
                            onChange={(event) => onUpdateOverride(model, event.target.value)}
                            placeholder={draft.cron}
                            className={cn(!validOverride && "border-destructive focus-visible:ring-destructive/20")}
                            disabled={saving}
                          />
                          {!validOverride ? <div className="text-xs text-destructive">{t("overrideCronHelp")}</div> : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
    </section>
  );
}

function ScopeCard({
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
        "flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/8 shadow-sm"
          : "border-border/70 bg-background hover:border-primary/40 hover:bg-primary/5",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
          {icon}
        </div>
        <div>
          <div className="text-sm font-medium">{title}</div>
          <div className="text-xs text-muted-foreground">{description}</div>
        </div>
      </div>
    </button>
  );
}
