"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, Globe2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/features/shared/view/page-header";
import { cn } from "@/lib/utils";
import {
  defaultPromptSchedule,
  promptScheduleLabel,
} from "./prompts-workspace-utils";
import { AIModel, ModelVisual, PromptItem, PromptSchedule } from "./types";

const GLOBAL_CADENCE_PRESETS = [
  { id: "6h", label: "Toutes les 6 heures", cron: "0 */6 * * *" },
  { id: "daily", label: "Chaque jour a 09:00", cron: "0 9 * * *" },
  { id: "twice-weekly", label: "Deux fois par semaine", cron: "0 9 * * 1,4" },
  { id: "weekends", label: "Tous les week-ends", cron: "30 8 * * 6,0" },
];

const PROMPT_STATUS_OPTIONS: Array<{
  value: PromptItem["status"];
  label: string;
}> = [
  {
    value: "active",
    label: "Actif",
  },
  {
    value: "disabled",
    label: "Desactive",
  },
  {
    value: "archived",
    label: "Archive",
  },
];

function getPromptStatusLabel(status: PromptItem["status"]) {
  if (status === "active") return "Actif";
  if (status === "disabled") return "Desactive";
  return "Archive";
}

function normalizeEditorSchedule(schedule: PromptSchedule, selectedModels: string[]): PromptSchedule {
  const allowed = new Set(selectedModels);
  const modelCrons = Object.fromEntries(
    Object.entries(schedule.modelCrons ?? {}).filter(
      ([modelId, cron]) => allowed.has(modelId) && cron.trim() !== "",
    ),
  );

  return {
    mode: schedule.mode === "per_model" ? "per_model" : "global",
    cron: schedule.cron.trim() || defaultPromptSchedule().cron,
    timezone: schedule.timezone.trim() || defaultPromptSchedule().timezone,
    modelCrons: schedule.mode === "per_model" ? modelCrons : {},
  };
}

type PromptEditorPageProps = {
  mode: "create" | "edit";
  prompt: PromptItem | null;
  availableModels: AIModel[];
  getModelVisual: (model: string) => ModelVisual;
  saving: boolean;
  onBack: () => void;
  onSave: (input: {
    text: string;
    modelIds: AIModel[];
    schedule: PromptSchedule;
    status: PromptItem["status"];
  }) => void;
};

export function PromptEditorPage({
  mode,
  prompt,
  availableModels,
  getModelVisual,
  saving,
  onBack,
  onSave,
}: PromptEditorPageProps) {
  const PROMPT_MAX_LENGTH = 500;
  const [promptText, setPromptText] = useState("");
  const [selectedModels, setSelectedModels] = useState<AIModel[]>([]);
  const [schedule, setSchedule] = useState<PromptSchedule>(defaultPromptSchedule());
  const [status, setStatus] = useState<PromptItem["status"]>("active");

  const promptModelKey = prompt?.models.join("|") ?? "";
  const defaultModels = useMemo(
    () => (prompt?.models.length ? prompt.models : availableModels.slice(0, 1)),
    [availableModels, prompt?.models],
  );

  useEffect(() => {
    const nextModels = prompt?.models.length ? prompt.models : availableModels.slice(0, 1);
    const nextSchedule = normalizeEditorSchedule(prompt?.schedule ?? defaultPromptSchedule(), nextModels);

    setPromptText(prompt?.prompt ?? "");
    setSelectedModels(nextModels);
    setSchedule(nextSchedule);
    setStatus(prompt?.status ?? "active");
  }, [availableModels, mode, prompt?.id, prompt?.prompt, prompt?.schedule, promptModelKey]);

  useEffect(() => {
    if (availableModels.length === 0) return;
    setSelectedModels((current) => {
      const kept = current.filter((model) => availableModels.includes(model));
      return kept.length > 0 ? kept : availableModels.slice(0, 1);
    });
  }, [availableModels]);

  useEffect(() => {
    setSchedule((current) => normalizeEditorSchedule(current, selectedModels));
  }, [selectedModels]);

  const toggleModel = (model: AIModel) => {
    setSelectedModels((current) =>
      current.includes(model)
        ? current.filter((item) => item !== model)
        : [...current, model],
    );
  };

  const toggleOverride = (model: AIModel, enabled: boolean) => {
    setSchedule((current) => {
      const nextModelCrons = { ...current.modelCrons };
      if (enabled) {
        nextModelCrons[model] = nextModelCrons[model] || current.cron;
      } else {
        delete nextModelCrons[model];
      }

      return {
        ...current,
        mode: enabled || Object.keys(nextModelCrons).length > 0 ? "per_model" : current.mode,
        modelCrons: nextModelCrons,
      };
    });
  };

  const updateOverride = (model: AIModel, cron: string) => {
    setSchedule((current) => ({
      ...current,
      modelCrons: {
        ...current.modelCrons,
        [model]: cron,
      },
    }));
  };

  const overridesCount = Object.keys(schedule.modelCrons).length;
  const normalizedSchedule = normalizeEditorSchedule(
    {
      ...schedule,
      modelCrons: schedule.mode === "per_model" ? schedule.modelCrons : {},
    },
    selectedModels,
  );
  const cadenceModeLabel =
    normalizedSchedule.mode === "global" ? "Cadence globale" : "Cadence par IA";
  const perModelSummary =
    overridesCount === 0
      ? "Aucune cadence personnalisee"
      : `${overridesCount} IA avec une cadence personnalisee`;
  const canSave =
    promptText.trim() !== "" &&
    promptText.length <= PROMPT_MAX_LENGTH &&
    selectedModels.length > 0 &&
    !saving;

  return (
    <div className="flex pt-44 h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title={mode === "create" ? "Nouveau prompt" : "Modifier le prompt"}
        baseline={
          mode === "create"
            ? "Creez le prompt, definissez la couverture IA et choisissez la cadence d'analyse au meme endroit."
            : "Modifiez le texte du prompt, la couverture IA et la cadence depuis une page dediee."
        }
        actionsVariant="classic"
        meta={
          <>
            <Badge variant="outline">{getPromptStatusLabel(status)}</Badge>
            <Badge variant="outline">{selectedModels.length} IA</Badge>
            <Badge variant="outline">
              {normalizedSchedule.mode === "global"
                ? cadenceModeLabel
                : `${overridesCount} IA personnalisee${overridesCount > 1 ? "s" : ""}`}
            </Badge>
          </>
        }
        actions={
          <Button type="button" onClick={onBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
        }
        className="hidden md:flex  pr-4"
      />

      <ScrollArea className="min-h-0 flex-1 pr-4 [&_[data-slot=scroll-area-scrollbar]]:w-2.5 [&_[data-slot=scroll-area-scrollbar]]:bg-muted/35 [&_[data-slot=scroll-area-thumb]]:rounded-full [&_[data-slot=scroll-area-thumb]]:border [&_[data-slot=scroll-area-thumb]]:border-background/60 [&_[data-slot=scroll-area-thumb]]:bg-muted-foreground/55">
        <div className="space-y-5 overflow-x-hidden pb-6">
          <section className="rounded-3xl rounded-tr-none bg-background p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <div className="text-sm font-medium">Prompt</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Redigez la requete exacte que vous voulez monitorer sur les IA selectionnees.
                </p>
              </div>
              <div className="text-xs text-muted-foreground">
                {promptText.length} / {PROMPT_MAX_LENGTH}
              </div>
            </div>
            <Textarea
              value={promptText}
              onChange={(event) => setPromptText(event.target.value.slice(0, PROMPT_MAX_LENGTH))}
              maxLength={PROMPT_MAX_LENGTH}
              placeholder="Ex : Quels sont les meilleurs CRM pour une PME B2B SaaS ?"
              className="mt-4 min-h-[220px] w-full max-w-full resize-y overflow-x-hidden text-sm leading-7 break-all [overflow-wrap:anywhere]"
            />

            <div className="mt-5 border-t pt-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div className="text-sm font-medium">Statut du prompt</div>
                <Badge variant="outline">{getPromptStatusLabel(status)}</Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
              {PROMPT_STATUS_OPTIONS.map((option) => {
                const selected = status === option.value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    disabled={saving}
                    onClick={() => setStatus(option.value)}
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

                    <div className="pr-5 text-sm font-semibold">{option.label}</div>
                  </button>
                );
              })}
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-background p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-2">
                <div className="text-sm font-medium">Couverture IA</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Choisissez les fournisseurs et les noms de modeles qui doivent rester actifs sur ce prompt.
                </p>
              </div>
              <Badge variant="outline">{selectedModels.length} selectionnes</Badge>
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
                    onClick={() => toggleModel(model)}
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

                    <img
                      src={visual.icon}
                      alt={visual.name}
                      className="mt-0.5 h-4 w-4 object-contain"
                      decoding="async"
                    />

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

          <section className="rounded-3xl bg-background p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium">
                  Cadence d'analyse
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  Choisissez un rythme global, ou activez une cadence personnalisee pour certaines IA si besoin.
                </p>
              </div>
              <div className="flex gap-2 text-xs">
                <span className="text-right font-medium">{cadenceModeLabel}</span>
                {normalizedSchedule.mode !== "global" ? null : (
                  <>
                    -
                    <span className="text-right font-medium">{promptScheduleLabel(normalizedSchedule)}</span>
                  </>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <button
                type="button"
                onClick={() =>
                  setSchedule((current) => ({
                    ...current,
                    mode: "global",
                    modelCrons: {},
                  }))
                }
                className={cn(
                  "cursor-pointer flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  normalizedSchedule.mode === "global"
                    ? "border-primary bg-primary/5"
                    : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Globe2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Globale</div>
                  <div className="text-xs text-muted-foreground">Meme cadence pour toutes les IA selectionnees</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() =>
                  setSchedule((current) => ({
                    ...current,
                    mode: "per_model",
                  }))
                }
                className={cn(
                  "cursor-pointer flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                  normalizedSchedule.mode === "per_model"
                    ? "border-primary bg-primary/5"
                    : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
                )}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Bot className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-medium">Par IA</div>
                  <div className="text-xs text-muted-foreground">Personnalise la cadence de base sur certaines IA</div>
                </div>
              </button>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-3">
                <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                  Prereglages rapides
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {GLOBAL_CADENCE_PRESETS.map((preset) => {
                    const active = normalizedSchedule.cron === preset.cron;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => setSchedule((current) => ({ ...current, cron: preset.cron }))}
                        className={cn(
                          "cursor-pointer rounded-2xl border px-4 py-3 text-left transition-colors",
                          active
                            ? "border-primary bg-primary/5"
                            : "border-border/70 bg-background hover:border-primary/30 hover:bg-muted/20",
                        )}
                      >
                        <div className="text-sm font-medium">{preset.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="prompt-timezone">Fuseau horaire</Label>
                  <Input
                    id="prompt-timezone"
                    value={schedule.timezone}
                    onChange={(event) =>
                      setSchedule((current) => ({ ...current, timezone: event.target.value }))
                    }
                    placeholder="UTC"
                    disabled={saving}
                    className="max-w-full [overflow-wrap:anywhere]"
                  />
                </div>
              </div>
            </div>

            {normalizedSchedule.mode === "per_model" ? (
              <div className="mt-5 space-y-3">
                <div className="text-sm font-medium">Cadences personnalisees par IA</div>
                <p className="text-sm leading-6 text-muted-foreground">
                  Chaque IA apparait ci-dessous. Cliquez sur `Definir une cadence propre` pour modifier une IA individuellement.
                </p>
                <div className="space-y-3">
                  {selectedModels.map((model) => {
                    const visual = getModelVisual(model);
                    const overrideCron = normalizedSchedule.modelCrons[model] || "";
                    const hasOverride = overrideCron !== "";
                    const currentCadenceLabel = hasOverride
                      ? promptScheduleLabel(normalizedSchedule, overrideCron)
                      : `${promptScheduleLabel(normalizedSchedule)} (globale)`;

                    return (
                      <div key={model} className="rounded-2xl border border-border/70 bg-muted/10 px-4 py-4">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div className="flex min-w-0 items-center gap-3">
                            <img
                              src={visual.icon}
                              alt={visual.name}
                              className="h-5 w-5 object-contain"
                              decoding="async"
                            />
                            <div className="min-w-0">
                              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
                                {visual.provider}
                              </div>
                              <div className="text-sm font-semibold break-words [overflow-wrap:anywhere]">
                                {visual.name}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            {hasOverride ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={saving}
                                onClick={() => toggleOverride(model, false)}
                              >
                                Revenir a la cadence globale
                              </Button>
                            ) : (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="rounded-full"
                                disabled={saving}
                                onClick={() => toggleOverride(model, true)}
                              >
                                Definir une cadence personnalisée
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                          Cadence actuelle : {currentCadenceLabel}
                        </div>

                        {hasOverride ? (
                          <div className="mt-4 space-y-3">
                            <div className="flex flex-wrap gap-2">
                              {GLOBAL_CADENCE_PRESETS.map((preset) => (
                                <Button
                                  key={`${model}-${preset.id}`}
                                  type="button"
                                  size="sm"
                                  variant={overrideCron === preset.cron ? "default" : "outline"}
                                  className="rounded-full"
                                  disabled={saving}
                                  onClick={() => updateOverride(model, preset.cron)}
                                >
                                  {preset.label}
                                </Button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </section>
        </div>
      </ScrollArea>

      <div className="border-t px-2 pt-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          <Button type="button" variant="outline" onClick={onBack} disabled={saving}>
            Annuler
          </Button>
          <Button
            type="button"
            disabled={!canSave}
            onClick={() =>
              onSave({
                text: promptText,
                modelIds: selectedModels,
                schedule: normalizedSchedule,
                status,
              })
            }
          >
            {saving ? "Enregistrement..." : mode === "create" ? "Creer le prompt" : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
