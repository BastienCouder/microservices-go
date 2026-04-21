import { useOnboarding, type PromptWithLanguage } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  OnboardingField,
  OnboardingStep,
  OnboardingStepFooter,
} from "./step-shell";

type StepPromptsProps = {
  hideBack?: boolean;
  nextLabel?: string;
};

export function StepPrompts({ hideBack = false, nextLabel = "Next" }: StepPromptsProps) {
  const {
    brandName,
    competitors,
    industry,
    selectedPrompts,
    setSelectedPrompts,
    nextStep,
    prevStep,
  } = useOnboarding();
  const { locale, t } = useScopedI18n("onboarding");

  const updatePrompt = (
    index: number,
    nextValue: Partial<PromptWithLanguage>,
  ) => {
    setSelectedPrompts(
      selectedPrompts.map((prompt, promptIndex) =>
        promptIndex === index
          ? {
              ...prompt,
              text: prompt.text ?? "",
              language: prompt.language ?? "en",
              ...nextValue,
            }
          : prompt,
      ),
    );
  };

  const addPrompt = (template = "") => {
    setSelectedPrompts([
      ...selectedPrompts,
      { text: template, language: locale },
    ]);
  };

  const generatePromptsWithAI = () => {
    const resolvedBrand = brandName.trim() || t("yourBrand");
    const competitorName = competitors[0]?.name?.trim();
    const resolvedIndustry = industry.trim();

    const generatedTexts =
      locale === "fr"
        ? [
            `quelles sont les meilleures alternatives à ${resolvedBrand} ?`,
            `${resolvedBrand} est-il fiable pour les entreprises ?`,
            competitorName
              ? `${resolvedBrand} vs ${competitorName} : quelle solution choisir ?`
              : `comment ${resolvedBrand} se compare-t-il à ses concurrents ?`,
            resolvedIndustry
              ? `quels sont les meilleurs outils IA pour ${resolvedIndustry} ?`
              : `quels sont les meilleurs outils comme ${resolvedBrand} en 2026 ?`,
          ]
        : [
            `what are the best alternatives to ${resolvedBrand}?`,
            `is ${resolvedBrand} reliable for enterprise teams?`,
            competitorName
              ? `${resolvedBrand} vs ${competitorName}: which solution is better?`
              : `how does ${resolvedBrand} compare to competitors?`,
            resolvedIndustry
              ? `what are the best AI tools for ${resolvedIndustry}?`
              : `top tools like ${resolvedBrand} in 2026`,
          ];

    const existingTexts = new Set(
      selectedPrompts.map((prompt) => prompt.text.trim().toLowerCase()),
    );
    const generatedPrompts = generatedTexts
      .filter((text) => !existingTexts.has(text.trim().toLowerCase()))
      .map((text) => ({ text, language: locale }));

    if (generatedPrompts.length === 0) {
      return;
    }

    setSelectedPrompts([...selectedPrompts, ...generatedPrompts]);
  };

  return (
    <OnboardingStep
      title={t("promptsTitle")}
      description={t("promptsDescription")}
      headerAction={
        <Button type="button" variant="outline" onClick={generatePromptsWithAI}>
          <Sparkles className="size-4 text-primary" />
          {t("generateWithAI")}
        </Button>
      }
      footer={
        <OnboardingStepFooter
          hideBack={hideBack}
          onBack={prevStep}
          onNext={nextStep}
          // nextDisabled={selectedPrompts.length < 1}
          nextLabel={nextLabel === "Next" ? undefined : nextLabel}
        />
      }
    >
      <div className="flex items-center justify-between rounded-md border border-border/70 bg-muted/20 px-4 py-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{t("promptsWorkspaceLabel")}</p>
          <p className="text-xs text-muted-foreground">
            {t("promptsConfigured", { count: selectedPrompts.length })}
          </p>
        </div>
        <Button variant="outline" onClick={() => addPrompt()}>
          <Plus className="size-4 text-primary" />
          {t("addPrompt")}
        </Button>
      </div>

      <div className="space-y-4">
        {selectedPrompts.map((prompt, index) => (
          <div
            key={index}
            className="space-y-3 rounded-md border border-border/70 p-4"
          >
            <div className="flex items-start gap-2">
              <Textarea
                value={prompt.text}
                onChange={(event) =>
                  updatePrompt(index, { text: event.target.value })
                }
                className="min-h-[96px] text-sm"
                placeholder={t("promptPlaceholder")}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setSelectedPrompts(
                    selectedPrompts.filter((_, promptIndex) => promptIndex !== index),
                  )
                }
                aria-label={t("remove")}
              >
                <Trash2 className="size-4 text-primary" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </OnboardingStep>
  );
}
