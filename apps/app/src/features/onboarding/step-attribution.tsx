import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useOnboarding } from "@/hooks/use-onboarding";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import {
  OnboardingField,
  OnboardingStep,
  OnboardingStepFooter,
} from "./step-shell";

type StepAttributionProps = {
  hideBack?: boolean;
  nextLabel?: string;
};

const PRESET_SOURCES = [
  "google",
  "linkedin",
  "x",
  "friend",
  "agency",
] as const;

export function StepAttribution({
  hideBack = false,
  nextLabel,
}: StepAttributionProps) {
  const { attributionSource, setAttributionSource, nextStep, prevStep } =
    useOnboarding();
  const { t } = useScopedI18n("onboarding");

  const selectedSource = PRESET_SOURCES.includes(
    attributionSource as (typeof PRESET_SOURCES)[number],
  )
    ? attributionSource
    : attributionSource.trim() !== "" || attributionSource === "other"
      ? "other"
      : "";

  return (
    <OnboardingStep
      title={t("attributionTitle")}
      description={t("attributionDescription")}
      footer={
        <OnboardingStepFooter
          hideBack={hideBack}
          onBack={prevStep}
          onNext={nextStep}
          nextLabel={nextLabel}
        />
      }
    >
      <OnboardingField
        label={t("attributionFieldLabel")}
        description={t("attributionFieldHint")}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PRESET_SOURCES.map((source) => {
            const selected = attributionSource === source;

            return (
              <Button
                key={source}
                type="button"
                variant="outline"
                className={cn(
                  "h-auto min-h-14 justify-start rounded-md px-4 py-3 text-left",
                  selected && "border-primary bg-primary/5 text-primary",
                )}
                onClick={() => setAttributionSource(source)}
              >
                {t(`attributionOption${source[0].toUpperCase()}${source.slice(1)}`)}
              </Button>
            );
          })}

          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-auto min-h-14 justify-start rounded-md px-4 py-3 text-left sm:col-span-2",
              selectedSource === "other" &&
                "border-primary bg-primary/5 text-primary",
            )}
            onClick={() => {
              if (selectedSource !== "other") {
                setAttributionSource("other");
              }
            }}
          >
            {t("attributionOptionOther")}
          </Button>
        </div>
      </OnboardingField>

      {selectedSource === "other" ? (
        <OnboardingField
          label={t("attributionOtherLabel")}
          htmlFor="attribution-other"
        >
          <Input
            id="attribution-other"
            value={
              PRESET_SOURCES.includes(
                attributionSource as (typeof PRESET_SOURCES)[number],
              )
                || attributionSource === "other"
                ? ""
                : attributionSource
            }
            onChange={(event) => setAttributionSource(event.target.value)}
            placeholder={t("attributionOtherPlaceholder")}
          />
        </OnboardingField>
      ) : null}
    </OnboardingStep>
  );
}
