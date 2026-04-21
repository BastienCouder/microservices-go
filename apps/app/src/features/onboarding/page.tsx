import { useEffect, useRef } from "react";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/hooks/use-onboarding";
import { OnboardingLeftPanel } from "./left-panel";
import { StepAnalysis } from "./step-analysis";
import { StepAttribution } from "./step-attribution";
import { StepBrand } from "./step-brand";
import { StepCompetitors } from "./step-competitors";
import { StepModels } from "./step-models";
import { StepProgress } from "./step-progress";
import { StepPrompts } from "./step-prompts";
import { StepWebsite } from "./step-website";
import { AnimatedWave } from "./animated-wave";
import { OnboardingLanguageSwitcher } from "./language-switcher";

type OnboardingPageProps = {
  apiBaseURL: string;
};

function OnboardingContent({ apiBaseURL }: OnboardingPageProps) {
  const { step } = useOnboarding();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  const steps = [
    { component: <StepWebsite />, id: 1 },
    { component: <StepAttribution />, id: 2 },
    { component: <StepBrand />, id: 3 },
    { component: <StepCompetitors />, id: 4 },
    { component: <StepPrompts />, id: 5 },
    { component: <StepModels apiBaseURL={apiBaseURL} />, id: 6 },
    { component: <StepAnalysis />, id: 7 },
  ];

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_34%),linear-gradient(180deg,_#f8f9fc_0%,_#f1f3f8_100%)] lg:h-screen">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <AnimatedWave />
      </div>

      <OnboardingLeftPanel />

      <section className="relative z-10 min-w-0 flex-1">
        <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center px-4">
          <StepProgress step={step} total={steps.length} />
        </div>

        <div className="absolute right-4 top-4 z-30 sm:right-6 lg:right-10">
          <OnboardingLanguageSwitcher />
        </div>

        <div ref={scrollContainerRef} className="h-full overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-5xl items-center px-4 pb-10 pt-16 sm:px-6 sm:pb-12 sm:pt-20 lg:px-10">
            <div className="mx-auto w-full max-w-[760px]">
              {steps[step - 1]?.component}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

export function OnboardingPage({ apiBaseURL }: OnboardingPageProps) {
  return (
    <OnboardingProvider totalSteps={7}>
      <OnboardingContent apiBaseURL={apiBaseURL} />
    </OnboardingProvider>
  );
}

export default OnboardingPage;
