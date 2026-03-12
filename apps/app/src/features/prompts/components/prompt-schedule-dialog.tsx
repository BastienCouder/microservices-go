"use client";

import { useEffect, useMemo, useState } from "react";
import { Bot, Clock3, Globe2, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import {
  describeCron,
  isValidCronExpression,
  promptScheduleLabel,
} from "./prompts-workspace-utils";
import { ModelVisual, PromptSchedule } from "./types";

const GLOBAL_PRESETS = [
  { id: "hourly", label: "Every hour", cron: "0 * * * *", note: "High-frequency monitoring" },
  { id: "6h", label: "Every 6 hours", cron: "0 */6 * * *", note: "Balanced baseline" },
  { id: "daily", label: "Every day at 09:00", cron: "0 9 * * *", note: "Morning snapshot" },
  { id: "weekdays", label: "Weekdays at 08:30", cron: "30 8 * * 1-5", note: "Business rhythm" },
];

const MODEL_PRESETS = [
  { id: "fast", label: "Every 2 hours", cron: "0 */2 * * *" },
  { id: "steady", label: "Every 6 hours", cron: "0 */6 * * *" },
  { id: "daily", label: "Every day at 09:00", cron: "0 9 * * *" },
];

type PromptScheduleDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  promptLabel: string;
  schedule: PromptSchedule;
  selectedModels: string[];
  getModelVisual: (model: string) => ModelVisual;
  saving?: boolean;
  onSave: (schedule: PromptSchedule) => void;
};

function normalizeSchedule(schedule: PromptSchedule, selectedModels: string[]): PromptSchedule {
  const allowed = new Set(selectedModels);
  const modelCrons = Object.fromEntries(
    Object.entries(schedule.modelCrons ?? {}).filter(
      ([modelId, cron]) => allowed.has(modelId) && cron.trim() !== "",
    ),
  );

  return {
    mode: schedule.mode === "per_model" ? "per_model" : "global",
    cron: schedule.cron.trim(),
    timezone: schedule.timezone.trim() || "UTC",
    modelCrons: schedule.mode === "per_model" ? modelCrons : {},
  };
}

function isKnownPreset(cron: string, presets: { cron: string }[]) {
  return presets.some((preset) => preset.cron === cron.trim());
}

export function PromptScheduleDialog({
  open,
  onOpenChange,
  promptLabel,
  schedule,
  selectedModels,
  getModelVisual,
  saving = false,
  onSave,
}: PromptScheduleDialogProps) {
  const [draft, setDraft] = useState<PromptSchedule>(schedule);
  const [showAdvancedCron, setShowAdvancedCron] = useState(false);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeSchedule(schedule, selectedModels);
    const hasCustomGlobalCron = !isKnownPreset(normalized.cron, GLOBAL_PRESETS);
    const hasCustomOverride = Object.values(normalized.modelCrons).some(
      (cron) => cron.trim() !== "" && !isKnownPreset(cron, MODEL_PRESETS),
    );

    setDraft(normalized);
    setShowAdvancedCron(hasCustomGlobalCron || hasCustomOverride);
  }, [open, schedule, selectedModels]);

  const selectedModelSet = useMemo(() => new Set(selectedModels), [selectedModels]);
  const validGlobalCron = isValidCronExpression(draft.cron);
  const invalidOverride = Object.entries(draft.modelCrons).find(
    ([, cron]) => cron.trim() !== "" && !isValidCronExpression(cron),
  );
  const isValid = validGlobalCron && !invalidOverride;
  const overridesCount = Object.keys(draft.modelCrons).length;

  const updateOverride = (modelId: string, cron: string) => {
    setDraft((current) => ({
      ...current,
      modelCrons: {
        ...current.modelCrons,
        [modelId]: cron,
      },
    }));
  };

  const toggleOverride = (modelId: string, enabled: boolean) => {
    setDraft((current) => {
      const nextOverrides = { ...current.modelCrons };
      if (enabled) {
        nextOverrides[modelId] = nextOverrides[modelId] || current.cron;
      } else {
        delete nextOverrides[modelId];
      }
      return { ...current, modelCrons: nextOverrides };
    });
  };

  const visibleModels = selectedModels.filter((model) => selectedModelSet.has(model));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100vw-2rem)] flex-col overflow-hidden !gap-0 !p-0 sm:!max-w-[1100px]">
        <div className="border-b bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.14),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%)] px-6 py-5">
          <DialogHeader className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-emerald-200 bg-emerald-50 text-emerald-700">
                Analysis cadence
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {draft.mode === "global" ? "Global cadence" : `${overridesCount} AI override${overridesCount > 1 ? "s" : ""}`}
              </Badge>
              <Badge variant="outline" className="rounded-full">
                {draft.timezone || "UTC"}
              </Badge>
            </div>
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div className="space-y-1">
                <DialogTitle className="text-xl">Customize analysis cadence</DialogTitle>
                <DialogDescription className="max-w-2xl line-clamp-2">
                  {promptLabel}
                </DialogDescription>
              </div>
              <div className="rounded-2xl border border-border/70 bg-background/80 px-4 py-3 text-sm shadow-sm md:max-w-sm">
                <div className="flex items-center gap-2 font-medium">
                  <Clock3 className="h-4 w-4 text-primary" />
                  {promptScheduleLabel(draft)}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {draft.mode === "global"
                    ? "One cadence applied across the whole prompt coverage."
                    : "Global baseline plus per-model overrides."}
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="grid items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
            <section className="min-w-0 space-y-4 rounded-3xl border border-border/70 bg-muted/20 p-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Cadence scope</div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Choose one rhythm for the whole prompt, or keep a shared baseline and customize it per AI.
                </p>
              </div>

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, mode: "global" }))}
                  className={cn(
                    "flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                    draft.mode === "global"
                      ? "border-primary bg-primary/8 shadow-sm"
                      : "border-border/70 bg-background hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Globe2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Global</div>
                      <div className="text-xs text-muted-foreground">Same cadence for all selected AI</div>
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setDraft((current) => ({ ...current, mode: "per_model" }))}
                  className={cn(
                    "flex min-h-14 items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                    draft.mode === "per_model"
                      ? "border-primary bg-primary/8 shadow-sm"
                      : "border-border/70 bg-background hover:border-primary/40 hover:bg-primary/5",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                      <Bot className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium">Per AI</div>
                      <div className="text-xs text-muted-foreground">Override the baseline for specific AI</div>
                    </div>
                  </div>
                </button>
              </div>

              <Separator />

              <div className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Current result
                </div>
                <div className="mt-2 text-sm font-semibold">{promptScheduleLabel(draft)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {draft.mode === "global"
                    ? "This cadence will be used for every AI in the prompt coverage."
                    : `${overridesCount} AI override${overridesCount > 1 ? "s" : ""} can diverge from the baseline.`}
                </div>
              </div>
            </section>

            <section className="min-w-0 space-y-5 rounded-3xl border border-border/70 bg-background p-4 shadow-sm">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Quick presets
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Pick a readable rhythm first. Use the advanced section only if you need a custom cron rule.
                </p>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {GLOBAL_PRESETS.map((preset) => {
                  const active = draft.cron === preset.cron;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setDraft((current) => ({ ...current, cron: preset.cron }))}
                      className={cn(
                        "rounded-2xl border px-4 py-3 text-left transition-colors",
                        active
                          ? "border-primary bg-primary/8 shadow-sm"
                          : "border-border/70 bg-background hover:border-primary/40 hover:bg-primary/5",
                      )}
                    >
                      <div className="text-sm font-medium">{preset.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{preset.note}</div>
                    </button>
                  );
                })}
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                  <div className="text-sm font-medium">{describeCron(draft.cron)}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {draft.mode === "global"
                      ? "Used as the main cadence for the full prompt coverage."
                      : "Used as the shared fallback before any per-AI override."}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prompt-timezone">Timezone label</Label>
                  <Input
                    id="prompt-timezone"
                    value={draft.timezone}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, timezone: event.target.value }))
                    }
                    placeholder="UTC"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-border/70 bg-muted/20 px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">Advanced custom rule</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Only open this if presets are not enough.
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs text-muted-foreground">Manual cron</Label>
                    <Switch
                      checked={showAdvancedCron}
                      onCheckedChange={setShowAdvancedCron}
                      disabled={saving}
                    />
                  </div>
                </div>

                {showAdvancedCron ? (
                  <div className="mt-4 space-y-2">
                    <Label htmlFor="global-cron">Global cron rule</Label>
                    <Input
                      id="global-cron"
                      value={draft.cron}
                      onChange={(event) =>
                        setDraft((current) => ({ ...current, cron: event.target.value }))
                      }
                      placeholder="0 */6 * * *"
                      className={cn(!validGlobalCron && "border-destructive focus-visible:ring-destructive/20")}
                      disabled={saving}
                    />
                    {!validGlobalCron ? (
                      <div className="text-xs text-destructive">
                        Use 5 cron fields, for example `0 */6 * * *`.
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Human label: {describeCron(draft.cron)}
                      </div>
                    )}
                  </div>
                ) : null}
              </div>

              {draft.mode === "global" ? (
                <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-4">
                  <div className="text-sm font-medium">Global mode</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Every AI attached to this prompt follows the same analysis cadence.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-dashed border-border/70 bg-muted/10 px-4 py-4">
                    <div className="text-sm font-medium">Per-AI overrides</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Keep a global baseline, then accelerate or slow down specific AI models.
                    </div>
                  </div>

                  <ScrollArea className="h-[320px] pr-4">
                    <div className="space-y-3">
                      {visibleModels.map((model) => {
                        const visual = getModelVisual(model);
                        const overrideCron = draft.modelCrons[model] || "";
                        const hasOverride = overrideCron !== "";
                        const validOverride = overrideCron === "" || isValidCronExpression(overrideCron);

                        return (
                          <div key={model} className="rounded-2xl border border-border/70 bg-background px-4 py-4">
                            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-muted/30">
                                  <img
                                    src={visual.icon}
                                    alt={visual.label}
                                    className="h-5 w-5 object-contain"
                                    decoding="async"
                                  />
                                </div>
                                <div>
                                  <div className="font-medium">{visual.label}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {hasOverride
                                      ? promptScheduleLabel(draft, overrideCron)
                                      : `Uses global cadence · ${promptScheduleLabel(draft)}`}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="rounded-full">
                                  {hasOverride ? "Custom override" : "Global fallback"}
                                </Badge>
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-muted-foreground">Override</Label>
                                  <Switch
                                    checked={hasOverride}
                                    onCheckedChange={(checked) => toggleOverride(model, checked)}
                                    disabled={saving}
                                  />
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
                                      onClick={() => updateOverride(model, preset.cron)}
                                      disabled={saving}
                                    >
                                      {preset.label}
                                    </Button>
                                  ))}
                                </div>

                                {showAdvancedCron ? (
                                  <div className="space-y-2">
                                    <Label htmlFor={`override-${model}`}>Custom cron rule</Label>
                                    <Input
                                      id={`override-${model}`}
                                      value={overrideCron}
                                      onChange={(event) => updateOverride(model, event.target.value)}
                                      placeholder={draft.cron}
                                      className={cn(!validOverride && "border-destructive focus-visible:ring-destructive/20")}
                                      disabled={saving}
                                    />
                                    {!validOverride ? (
                                      <div className="text-xs text-destructive">
                                        Use 5 cron fields for the override.
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              )}
            </section>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            disabled={!isValid || saving}
            onClick={() =>
              onSave(
                normalizeSchedule(
                  {
                    ...draft,
                    modelCrons:
                      draft.mode === "per_model"
                        ? draft.modelCrons
                        : {},
                  },
                  selectedModels,
                ),
              )
            }
          >
            {saving ? "Saving..." : "Save cadence"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
