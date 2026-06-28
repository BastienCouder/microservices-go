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
import { Plus, Trash2 } from "lucide-react";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { PromptLanguageIndicator } from "@/features/prompts/_components/shared/prompt-language-indicator";
import {
  OnboardingStep,
  OnboardingStepFooter,
} from "./step-shell";

type StepPromptsProps = {
  hideBack?: boolean;
  nextLabel?: string;
};

export function StepPrompts({ hideBack = false, nextLabel }: StepPromptsProps) {
  const {
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

  return (
    <OnboardingStep
      title={t("promptsTitle")}
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
