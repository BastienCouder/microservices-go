import { useEffect, useRef } from "react";
import { readOrganizationIdFromSearch, readSelectedOrganizationID } from "@/shared/selection";
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
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

type OnboardingPageProps = {
  apiBaseURL: string;
  routeSearch?: string;
};

function OnboardingContent({ apiBaseURL, routeSearch = "" }: OnboardingPageProps) {
  const { step } = useOnboarding();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const selectedOrganizationId =
    readSelectedOrganizationID() || readOrganizationIdFromSearch(routeSearch);
  const hasOrganizationContext = selectedOrganizationId !== "";

  const steps = [
    { component: <StepWebsite askOrganizationName={!hasOrganizationContext} />, id: 1 },
    ...(!hasOrganizationContext ? [{ component: <StepAttribution />, id: 2 }] : []),
    { component: <StepBrand />, id: hasOrganizationContext ? 2 : 3 },
    { component: <StepCompetitors />, id: hasOrganizationContext ? 3 : 4 },
    { component: <StepPrompts />, id: hasOrganizationContext ? 4 : 5 },
    { component: <StepModels apiBaseURL={apiBaseURL} />, id: hasOrganizationContext ? 5 : 6 },
    { component: <StepAnalysis apiBaseURL={apiBaseURL} />, id: hasOrganizationContext ? 6 : 7 },
  ];

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

    const navigate = useNavigate();


  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_34%),linear-gradient(180deg,_#f8f9fc_0%,_#f1f3f8_100%)] lg:h-screen">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <AnimatedWave />
      </div>

      <OnboardingLeftPanel />

      <section className="relative z-10 min-w-0 flex-1">
        
        <div className="absolute left-4 top-4 z-30 sm:right-6 lg:right-10">
          <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center text-xs font-medium text-muted-foreground gap-1 rounded-full border-none bg-white/50 hover:bg-white/80 p-1.5 outline-none backdrop-blur">
           <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </div>
        
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

export function OnboardingPage({ apiBaseURL, routeSearch }: OnboardingPageProps) {
  const selectedOrganizationId =
    readSelectedOrganizationID() || readOrganizationIdFromSearch(routeSearch ?? "");
  const totalSteps = selectedOrganizationId ? 6 : 7;

  return (
    <OnboardingProvider totalSteps={totalSteps}>
      <OnboardingContent apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
    </OnboardingProvider>
  );
}

export default OnboardingPage;
