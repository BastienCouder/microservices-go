"use client";

import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Play, Save } from "lucide-react";
import { ModelCard } from "@/components/shared/model-card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Stepper,
  StepperContent,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperPanel,
  StepperSeparator,
  StepperTitle,
  StepperTrigger,
} from "@/components/ui/stepper";
import { Textarea } from "@/components/ui/textarea";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { appQueryKeys } from "@/lib/query-keys";
import { type ProjectModelMeta } from "@/lib/project-models";
import { cn } from "@/lib/utils";
import { PromptLanguageIndicator } from "@/features/prompts/_components/shared/prompt-language-indicator";
import {
  createProjectPrompt,
  loadAllPromptPages,
  patchPrompt,
} from "@/features/prompts/_lib/prompt-api";
import type {
  ProjectPromptRecord,
  PromptLanguage,
} from "@/features/prompts/_lib/types";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

type PromptDraft = {
  id: string;
  text: string;
  language: PromptLanguage;
  persisted: boolean;
  templateId: string | null;
};

type DefaultPromptTemplate = {
  id: string;
  text: string;
  language: PromptLanguage;
};

type RunPerceptionAnalysisInput = {
  promptIds: string[];
  modelIds: string[];
  estimatedCredits: number;
};

type PerceptionAnalysisStepperDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  apiBaseURL: string;
  organizationId: string;
  projectId: string;
  brandName: string;
  category: string;
  modelOptions: ProjectModelMeta[];
  primaryLanguage: PromptLanguage;
  running: boolean;
  quotaLoading: boolean;
  monthlyCredits: number;
  remainingCredits: number;
  onRun: (input: RunPerceptionAnalysisInput) => Promise<void>;
};

const STEP_PROMPTS = 1;
const STEP_MODELS = 2;
const STEP_RECAP = 3;
const DEFAULT_PROMPT_TEMPLATE_ORDER = [
  "default-positioning",
  "default-audience",
  "default-differentiation",
] as const;

function buildDefaultPerceptionPromptTemplates(input: {
  brandName: string;
  category: string;
  language: PromptLanguage;
}): DefaultPromptTemplate[] {
  const brand = input.brandName.trim() || "the brand";
  const category = input.category.trim() || "its category";

  if (input.language === "fr") {
    const frenchBrand = input.brandName.trim() || "la marque";
    const frenchCategory = input.category.trim() || "sa catégorie";
    return [
      {
        id: "default-positioning",
        text: `Qu'est-ce que ${frenchBrand}, et comment décrirais-tu son positionnement dans ${frenchCategory} ?`,
        language: "fr",
      },
      {
        id: "default-audience",
        text: `À qui s'adresse ${frenchBrand}, et quels problèmes ou cas d'usage résout-elle ?`,
        language: "fr",
      },
      {
        id: "default-differentiation",
        text: `Comment ${frenchBrand} se compare à ses concurrents, et quels sont ses principaux points forts, faiblesses et signaux de confiance ?`,
        language: "fr",
      },
    ];
  }

  return [
    {
      id: "default-positioning",
      text: `What is ${brand}, and how would you describe its positioning in ${category}?`,
      language: "en",
    },
    {
      id: "default-audience",
      text: `Who is ${brand} for, and what problems or use cases does it solve?`,
      language: "en",
    },
    {
      id: "default-differentiation",
      text: `How does ${brand} compare with its competitors, and what are its main strengths, weaknesses, and trust signals?`,
      language: "en",
    },
  ];
}

function buildDefaultPerceptionPrompts(input: {
  brandName: string;
  category: string;
  language: PromptLanguage;
}): PromptDraft[] {
  return buildDefaultPerceptionPromptTemplates(input).map((template) => ({
    ...template,
    persisted: false,
    templateId: template.id,
  }));
}

function normalizePromptTextForTemplateMatch(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}

function findDefaultPromptTemplateId(
  text: string,
  input: { brandName: string; category: string },
): string | null {
  const normalizedText = normalizePromptTextForTemplateMatch(text);
  for (const language of ["fr", "en"] as const) {
    for (const template of buildDefaultPerceptionPromptTemplates({
      ...input,
      language,
    })) {
      if (normalizePromptTextForTemplateMatch(template.text) === normalizedText) {
        return template.id;
      }
    }
  }
  return null;
}

function toPromptDraft(prompt: ProjectPromptRecord): PromptDraft {
  return {
    id: prompt.id,
    text: prompt.text,
    language: prompt.language,
    persisted: true,
    templateId: null,
  };
}

function resolvePromptTemplateId(
  prompt: Pick<PromptDraft, "text">,
  input: { brandName: string; category: string },
  fallbackIndex?: number,
): string | null {
  const matched = findDefaultPromptTemplateId(prompt.text, input);
  if (matched) return matched;
  if (
    typeof fallbackIndex === "number" &&
    fallbackIndex >= 0 &&
    fallbackIndex < DEFAULT_PROMPT_TEMPLATE_ORDER.length
  ) {
    return DEFAULT_PROMPT_TEMPLATE_ORDER[fallbackIndex];
  }
  return null;
}

function assignPromptTemplateIds(
  prompts: PromptDraft[],
  input: { brandName: string; category: string },
): PromptDraft[] {
  const allowIndexFallback = prompts.length <= DEFAULT_PROMPT_TEMPLATE_ORDER.length;
  return prompts.map((prompt, index) => ({
    ...prompt,
    templateId:
      prompt.templateId ??
      resolvePromptTemplateId(prompt, input, allowIndexFallback ? index : undefined),
  }));
}

function calculateCredits(promptCount: number, models: ProjectModelMeta[]): number {
  return models.reduce(
    (total, model) => total + Math.max(1, Math.floor(model.creditCost || 1)),
    0,
  ) * promptCount;
}

export function PerceptionAnalysisStepperDialog({
  open,
  onOpenChange,
  apiBaseURL,
  organizationId,
  projectId,
  brandName,
  category,
  modelOptions,
  primaryLanguage,
  running,
  quotaLoading,
  monthlyCredits,
  remainingCredits,
  onRun,
}: PerceptionAnalysisStepperDialogProps) {
  const { t } = useScopedI18n("perception");
  const queryClient = useQueryClient();
  const [activeStep, setActiveStep] = useState(STEP_PROMPTS);
  const [drafts, setDrafts] = useState<PromptDraft[]>([]);
  const [selectedPromptIds, setSelectedPromptIds] = useState<string[]>([]);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);
  const [promptLanguage, setPromptLanguage] = useState<PromptLanguage>(primaryLanguage);
  const [savingPrompts, setSavingPrompts] = useState(false);

  const promptsQuery = useQuery({
    queryKey: appQueryKeys.promptsCatalog(
      apiBaseURL,
      organizationId,
      projectId,
      "",
      "createdAt",
      "asc",
    ),
    enabled:
      open &&
      apiBaseURL.trim() !== "" &&
      organizationId.trim() !== "" &&
      projectId.trim() !== "",
    queryFn: ({ signal }) =>
      loadAllPromptPages(apiBaseURL, organizationId, projectId, "", signal),
  });

  const perceptionPrompts = useMemo(
    () => (promptsQuery.data ?? []).filter((prompt) => prompt.kind === "perception"),
    [promptsQuery.data],
  );
  const availableModels = useMemo(
    () => modelOptions.filter((model) => model.live),
    [modelOptions],
  );
  const selectedModels = useMemo(
    () => availableModels.filter((model) => selectedModelIds.includes(model.id)),
    [availableModels, selectedModelIds],
  );
  const estimatedCredits = useMemo(
    () => calculateCredits(selectedPromptIds.length, selectedModels),
    [selectedPromptIds.length, selectedModels],
  );

  useEffect(() => {
    if (!open) return;
    setActiveStep(STEP_PROMPTS);
    setSelectedModelIds(availableModels.map((model) => model.id));
    setPromptLanguage(primaryLanguage);
  }, [availableModels, open, primaryLanguage]);

  useEffect(() => {
    if (!open || promptsQuery.isLoading) return;
    const nextDrafts = assignPromptTemplateIds(
      perceptionPrompts.length > 0
        ? perceptionPrompts.map(toPromptDraft)
        : buildDefaultPerceptionPrompts({
            brandName,
            category,
            language: primaryLanguage,
          }),
      { brandName, category },
    );
    setDrafts(nextDrafts);
    setSelectedPromptIds(nextDrafts.map((prompt) => prompt.id));
    setPromptLanguage(nextDrafts[0]?.language ?? primaryLanguage);
  }, [
    brandName,
    category,
    open,
    perceptionPrompts,
    primaryLanguage,
    promptsQuery.isLoading,
  ]);

  const handlePromptLanguageChange = (value: string) => {
    const language: PromptLanguage = value === "en" ? "en" : "fr";
    const templates = buildDefaultPerceptionPromptTemplates({
      brandName,
      category,
      language,
    });
    setPromptLanguage(language);
    setDrafts((current) =>
      current.map((draft) => {
        const templateId =
          draft.templateId ||
          findDefaultPromptTemplateId(draft.text, { brandName, category });
        const template = templateId
          ? templates.find((entry) => entry.id === templateId)
          : null;
        return {
          ...draft,
          language,
          templateId,
          text: template?.text ?? draft.text,
        };
      }),
    );
  };

  const handlePromptToggle = (id: string) => {
    setSelectedPromptIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const handlePromptTextChange = (id: string, text: string) => {
    setDrafts((current) =>
      current.map((draft) => (draft.id === id ? { ...draft, text } : draft)),
    );
  };

  const handleModelToggle = (id: string) => {
    setSelectedModelIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const savePromptDrafts = async (): Promise<string[]> => {
    const savedPromptIds: string[] = [];
    const nextDrafts: PromptDraft[] = [];
    const oldToNewId = new Map<string, string>();

    for (const draft of drafts) {
      const text = draft.text.trim();
      if (text === "") continue;

      if (draft.persisted) {
        await patchPrompt(apiBaseURL, organizationId, draft.id, {
          text,
          language: draft.language,
          kind: "perception",
          status: "active",
        });
        nextDrafts.push({ ...draft, text, persisted: true });
        savedPromptIds.push(draft.id);
        oldToNewId.set(draft.id, draft.id);
        continue;
      }

      const created = await createProjectPrompt(
        apiBaseURL,
        organizationId,
        projectId,
        text,
        draft.language,
        "perception",
      );
      nextDrafts.push({
        ...toPromptDraft(created),
        templateId: draft.templateId,
      });
      savedPromptIds.push(created.id);
      oldToNewId.set(draft.id, created.id);
    }

    const nextSelectedPromptIds = selectedPromptIds
      .map((id) => oldToNewId.get(id) ?? id)
      .filter((id) => savedPromptIds.includes(id));

    setDrafts(nextDrafts);
    setSelectedPromptIds(nextSelectedPromptIds);
    await queryClient.invalidateQueries({
      queryKey: appQueryKeys.promptsCatalog(
        apiBaseURL,
        organizationId,
        projectId,
        "",
        "createdAt",
        "asc",
      ),
    });

    return nextSelectedPromptIds;
  };

  const canContinueFromPrompts =
    selectedPromptIds.length > 0 &&
    drafts
      .filter((draft) => selectedPromptIds.includes(draft.id))
      .every((draft) => draft.text.trim() !== "");
  const canContinueFromModels = selectedModelIds.length > 0;
  const quotaExceeded = monthlyCredits > 0 && remainingCredits < estimatedCredits;

  const handleSaveAndContinue = async () => {
    if (!canContinueFromPrompts || savingPrompts) return;
    setSavingPrompts(true);
    try {
      const savedPromptIds = await savePromptDrafts();
      if (savedPromptIds.length === 0) {
        pushErrorToast(new Error("empty"), t("analysisPromptsSaveError"));
        return;
      }
      pushSuccessToast(t("analysisPromptsSaved"));
      setActiveStep(STEP_MODELS);
    } catch (error) {
      pushErrorToast(error, t("analysisPromptsSaveError"));
    } finally {
      setSavingPrompts(false);
    }
  };

  const handleRun = async () => {
    if (selectedPromptIds.length === 0 || selectedModelIds.length === 0) return;
    await onRun({
      promptIds: selectedPromptIds,
      modelIds: selectedModelIds,
      estimatedCredits,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{t("analysisWizardTitle")}</DialogTitle>
          <DialogDescription>{t("analysisWizardDescription")}</DialogDescription>
        </DialogHeader>

        <Stepper value={activeStep} onValueChange={setActiveStep}>
          <StepperNav className="mb-5">
            {[
              [STEP_PROMPTS, t("analysisStepPrompts")],
              [STEP_MODELS, t("analysisStepModels")],
              [STEP_RECAP, t("analysisStepRecap")],
            ].map(([step, label], index) => (
              <StepperItem key={step} step={Number(step)}>
                <StepperTrigger
                  className={cn(
                    "rounded-md border px-3 py-2",
                    activeStep === Number(step) ? "border-primary" : "border-border",
                  )}
                >
                  <StepperIndicator>{step}</StepperIndicator>
                  <StepperTitle>{label}</StepperTitle>
                </StepperTrigger>
                {index < 2 ? <StepperSeparator /> : null}
              </StepperItem>
            ))}
          </StepperNav>

          <StepperPanel>
            <StepperContent value={STEP_PROMPTS}>
              <div className="space-y-4">
                <div className="rounded-lg border border-border/70 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">{t("analysisPromptLanguage")}</p>
                    <Select
                      value={promptLanguage}
                      onValueChange={handlePromptLanguageChange}
                      disabled={savingPrompts}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue>
                          <PromptLanguageIndicator
                            language={promptLanguage}
                            label={
                              promptLanguage === "fr"
                                ? t("analysisPromptLanguageFr")
                                : t("analysisPromptLanguageEn")
                            }
                          />
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fr">
                          <PromptLanguageIndicator
                            language="fr"
                            label={t("analysisPromptLanguageFr")}
                          />
                        </SelectItem>
                        <SelectItem value="en">
                          <PromptLanguageIndicator
                            language="en"
                            label={t("analysisPromptLanguageEn")}
                          />
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {promptsQuery.isLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border/70 p-4 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    {t("analysisPromptsLoading")}
                  </div>
                ) : null}

                {drafts.map((draft, index) => (
                  <div key={draft.id} className="rounded-lg border border-border/70 p-3">
                    <label className="mb-2 flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={selectedPromptIds.includes(draft.id)}
                        onCheckedChange={() => handlePromptToggle(draft.id)}
                      />
                      {t("analysisPromptLabel", { index: index + 1 })}
                    </label>
                    <Textarea
                      value={draft.text}
                      onChange={(event) => handlePromptTextChange(draft.id, event.target.value)}
                      rows={4}
                    />
                  </div>
                ))}
              </div>
            </StepperContent>

            <StepperContent value={STEP_MODELS}>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {availableModels.map((model) => (
                  <ModelCard
                    key={model.id}
                    name={model.displayName}
                    description={model.description}
                    icon={model.iconPath}
                    selected={selectedModelIds.includes(model.id)}
                    onClick={() => handleModelToggle(model.id)}
                    modelGroup={model.groupName}
                    metaLabel={t("analysisCreditsPerRun", { credits: model.creditCost })}
                    size="medium"
                    variant="models"
                  />
                ))}
              </div>
            </StepperContent>

            <StepperContent value={STEP_RECAP}>
              <div className="space-y-3 rounded-lg border border-border/70 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <RecapMetric label={t("analysisSelectedPrompts")} value={selectedPromptIds.length} />
                  <RecapMetric label={t("analysisSelectedModels")} value={selectedModelIds.length} />
                  <RecapMetric label={t("analysisTotalCredits")} value={estimatedCredits} />
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("analysisCreditFormula", {
                    prompts: selectedPromptIds.length,
                    models: selectedModelIds.length,
                    credits: estimatedCredits,
                  })}
                </p>
                {monthlyCredits > 0 ? (
                  <p
                    className={cn(
                      "rounded-md border px-3 py-2 text-sm",
                      quotaExceeded
                        ? "border-destructive/30 bg-destructive/10 text-destructive"
                        : "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                    )}
                  >
                    {t("analysisQuotaSummary", {
                      remaining: remainingCredits,
                      total: monthlyCredits,
                    })}
                  </p>
                ) : null}
              </div>
            </StepperContent>
          </StepperPanel>
        </Stepper>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() =>
              activeStep === STEP_PROMPTS
                ? onOpenChange(false)
                : setActiveStep((current) => Math.max(STEP_PROMPTS, current - 1))
            }
            disabled={savingPrompts || running}
          >
            {activeStep === STEP_PROMPTS ? t("cancel") : t("analysisBack")}
          </Button>
          {activeStep === STEP_PROMPTS ? (
            <Button
              onClick={handleSaveAndContinue}
              disabled={!canContinueFromPrompts || savingPrompts}
            >
              {savingPrompts ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              {savingPrompts ? t("analysisSavingPrompts") : t("analysisSaveAndContinue")}
            </Button>
          ) : activeStep === STEP_MODELS ? (
            <Button onClick={() => setActiveStep(STEP_RECAP)} disabled={!canContinueFromModels}>
              {t("analysisContinue")}
            </Button>
          ) : (
            <Button
              onClick={handleRun}
              disabled={running || quotaLoading || quotaExceeded || estimatedCredits <= 0}
            >
              {running ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
              {running ? t("analysisRunning") : t("launchAnalysis")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RecapMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/70 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
