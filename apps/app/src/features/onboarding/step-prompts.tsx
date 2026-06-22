import { useOnboarding, type PromptWithLanguage } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Sparkles, Trash2 } from "lucide-react";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { PromptLanguageIndicator } from "@/features/prompts/_components/shared/prompt-language-indicator";
import {
  OnboardingField,
  OnboardingStep,
  OnboardingStepFooter,
} from "./step-shell";

type StepPromptsProps = {
  hideBack?: boolean;
  nextLabel?: string;
};

export function StepPrompts({ hideBack = false, nextLabel }: StepPromptsProps) {
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
    const resolvedUseCase =
      resolvedIndustry || (locale === "fr" ? "mon besoin" : "my use case");

    const generatedTexts =
      locale === "fr"
        ? [
            `meilleure alternative à ${resolvedBrand}`,
            `remplacer ${resolvedBrand} par quoi ?`,
            `outil similaire à ${resolvedBrand}`,
            `c'est quoi comme ${resolvedBrand} mais moins cher`,
            competitorName
              ? `${resolvedBrand} ou ${competitorName} lequel choisir`
              : `${resolvedBrand} ou quel concurrent choisir`,
            competitorName
              ? `différence entre ${resolvedBrand} et ${competitorName}`
              : `différence entre ${resolvedBrand} et ses concurrents`,
            competitorName
              ? `${resolvedBrand} vs ${competitorName}`
              : `${resolvedBrand} vs concurrents`,
            `${resolvedBrand} c'est bien ?`,
            `${resolvedBrand} avis`,
            `${resolvedBrand} ça vaut quoi`,
            `${resolvedBrand} fiable ou pas`,
            `meilleur outil pour ${resolvedUseCase}`,
            `quel outil pour ${resolvedUseCase}`,
            `comment faire ${resolvedUseCase} avec l'IA`,
            resolvedIndustry
              ? `outil IA ${resolvedIndustry} recommandation`
              : `outil IA recommandation`,
            `${resolvedBrand} ça coûte combien`,
            `${resolvedBrand} gratuit ou payant`,
            `vaut le coup ${resolvedBrand} pour une petite boite`,
          ]
        : [
            `best alternative to ${resolvedBrand}`,
            `what can replace ${resolvedBrand}?`,
            `tool similar to ${resolvedBrand}`,
            `what is like ${resolvedBrand} but cheaper`,
            competitorName
              ? `${resolvedBrand} or ${competitorName} which one to choose`
              : `${resolvedBrand} or which competitor to choose`,
            competitorName
              ? `difference between ${resolvedBrand} and ${competitorName}`
              : `difference between ${resolvedBrand} and competitors`,
            competitorName
              ? `${resolvedBrand} vs ${competitorName}`
              : `${resolvedBrand} vs competitors`,
            `is ${resolvedBrand} good?`,
            `${resolvedBrand} reviews`,
            `is ${resolvedBrand} worth it`,
            `is ${resolvedBrand} reliable or not`,
            `best tool for ${resolvedUseCase}`,
            `which tool for ${resolvedUseCase}`,
            `how to do ${resolvedUseCase} with AI`,
            resolvedIndustry
              ? `recommended AI tool for ${resolvedIndustry}`
              : `recommended AI tool`,
            `how much does ${resolvedBrand} cost`,
            `${resolvedBrand} free or paid`,
            `is ${resolvedBrand} worth it for a small business`,
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
      headerAction={
        <Button type="button" variant="outline" onClick={generatePromptsWithAI}>
          {t("generateWithAI")}
        </Button>
      }
      footer={
        <OnboardingStepFooter
          hideBack={hideBack}
          onBack={prevStep}
          onNext={nextStep}
          // nextDisabled={selectedPrompts.length < 1}
          nextLabel={nextLabel}
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
              <div className="flex-1 space-y-3">
                <Textarea
                  value={prompt.text}
                  onChange={(event) =>
                    updatePrompt(index, { text: event.target.value })
                  }
                  className="min-h-[96px] text-sm"
                  placeholder={t("promptPlaceholder")}
                />
                <Select
                  value={prompt.language || locale}
                  onValueChange={(value) =>
                    updatePrompt(index, { language: value })
                  }
                >
                  <SelectTrigger className="w-full sm:w-44" size="sm">
                    <SelectValue placeholder={t("selectLanguage")} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">
                      <PromptLanguageIndicator
                        language="fr"
                        label={t("languageFrench")}
                        flagClassName="text-sm"
                      />
                    </SelectItem>
                    <SelectItem value="en">
                      <PromptLanguageIndicator
                        language="en"
                        label={t("languageEnglish")}
                        flagClassName="text-sm"
                      />
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
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
