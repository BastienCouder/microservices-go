import { useOnboarding, type CompetitorItem } from "@/hooks/use-onboarding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  OnboardingField,
  OnboardingStep,
  OnboardingStepFooter,
} from "./step-shell";

type StepCompetitorsProps = {
  hideBack?: boolean;
  nextLabel?: string;
};

export function StepCompetitors({ hideBack = false, nextLabel }: StepCompetitorsProps) {
  const { competitors, setCompetitors, nextStep, prevStep } = useOnboarding();
  const { t } = useScopedI18n("onboarding");
  const [newName, setNewName] = useState("");
  const [newWebsite, setNewWebsite] = useState("");

  const updateCompetitor = (
    index: number,
    key: keyof CompetitorItem,
    value: string,
  ) => {
    setCompetitors(
      competitors.map((competitor, competitorIndex) =>
        competitorIndex === index
          ? {
              ...competitor,
              [key]: value,
              ...(key === "name"
                ? { logo: value.slice(0, 2).toUpperCase() }
                : {}),
            }
          : competitor,
      ),
    );
  };

  const addCompetitor = () => {
    const name = newName.trim();
    const website = newWebsite.trim();
    if (!name || !website) return;
    if (
      competitors.some(
        (competitor) => competitor.name.toLowerCase() === name.toLowerCase(),
      )
    ) {
      return;
    }

    setCompetitors([
      ...competitors,
      { name, website, logo: name.slice(0, 2).toUpperCase() },
    ]);
    setNewName("");
    setNewWebsite("");
  };

  return (
    <OnboardingStep
      title={t("competitorsTitle")}
      description={t("competitorsDescription")}
      footer={
        <OnboardingStepFooter
          hideBack={hideBack}
          onBack={prevStep}
          onNext={nextStep}
          // nextDisabled={competitors.length < 1}
          nextLabel={nextLabel}
        />
      }
    >
      <OnboardingField
        label={t("competitorsFieldLabel")}
        description={t("competitorsFieldHint")}
      >
        <div className="space-y-3">
          {competitors.map((competitor, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_44px]"
            >
              <Input
                value={competitor.name}
                onChange={(event) =>
                  updateCompetitor(index, "name", event.target.value)
                }
                placeholder={t("competitorNamePlaceholder")}
              />
              <Input
                value={competitor.website}
                onChange={(event) =>
                  updateCompetitor(index, "website", event.target.value)
                }
                placeholder={t("competitorWebsitePlaceholder")}
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() =>
                  setCompetitors(
                    competitors.filter((_, competitorIndex) => competitorIndex !== index),
                  )
                }
                aria-label={t("remove")}
              >
                <Trash2 className="size-4 text-primary" />
              </Button>
            </div>
          ))}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto]">
            <Input
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              placeholder={t("competitorNamePlaceholder")}
            />
            <Input
              value={newWebsite}
              onChange={(event) => setNewWebsite(event.target.value)}
              placeholder={t("competitorWebsitePlaceholder")}
            />
            <Button variant="outline" size="sm" onClick={addCompetitor}>
              {t("addCompetitor")}
            </Button>
          </div>
        </div>
      </OnboardingField>
    </OnboardingStep>
  );
}
