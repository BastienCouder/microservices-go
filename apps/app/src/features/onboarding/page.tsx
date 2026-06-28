import { useEffect, useRef } from "react";
import {
  OnboardingProvider,
  useOnboarding,
} from "@/hooks/use-onboarding";
import { StepAttribution } from "./step-attribution";
import { StepBrand } from "./step-brand";
import { StepCompetitors } from "./step-competitors";
import { StepModels } from "./step-models";
import { StepProgress } from "./step-progress";
import { StepPrompts } from "./step-prompts";
import { StepWebsite } from "./step-website";
import { AnimatedWave } from "./animated-wave";
import { OnboardingLanguageSwitcher } from "./language-switcher";
import {
  createFreshOnboardingInitialState,
  getOnboardingSetupMode,
  resolveOnboardingOrganizationId,
  shouldStartFreshOnboarding,
} from "./onboarding-mode";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

type OnboardingPageProps = {
  apiBaseURL: string;
  routeSearch?: string;
};

function OnboardingContent({ apiBaseURL, routeSearch = "" }: OnboardingPageProps) {
  const { step } = useOnboarding();
  const navigate = useNavigate();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const setupMode = getOnboardingSetupMode(routeSearch);
  const selectedOrganizationId = resolveOnboardingOrganizationId(routeSearch);
  const hasOrganizationContext = selectedOrganizationId !== "";
  const includesAccountSetup = setupMode === "account" || !hasOrganizationContext;

  const steps = [
    /* ...(!hasOrganizationContext ? [{ component: <StepAccountType />, id: 1 }] : []),*/
    {
      component: (
        <StepWebsite
          apiBaseURL={apiBaseURL}
          organizationId={selectedOrganizationId}
          showOrganizationName={setupMode === "account"}
        />
      ),
      id: 1,
    },
    ...(includesAccountSetup ? [{ component: <StepAttribution />, id: 2 }] : []),
    {
      component: <StepBrand apiBaseURL={apiBaseURL} />,
      id: includesAccountSetup ? 3 : 2,
    },
    { component: <StepCompetitors />, id: includesAccountSetup ? 4 : 3 },
    { component: <StepPrompts />, id: includesAccountSetup ? 5 : 4 },
    {
      component: (
        <StepModels
          apiBaseURL={apiBaseURL}
          organizationId={selectedOrganizationId}
        />
      ),
      id: includesAccountSetup ? 6 : 5,
    },
  ];

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_34%),linear-gradient(180deg,_#f8f9fc_0%,_#f1f3f8_100%)] lg:h-screen">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <AnimatedWave />
      </div>

     {/* <div className="hidden xl:block">
        <OnboardingLeftPanel />
      </div>
     */}
      <section className="relative z-10 min-w-0 flex-1">
        <div className="absolute left-4 top-4 z-30 sm:right-6 lg:right-10">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="flex items-center gap-1 rounded-full !border-0 !ring-0 bg-white/50 p-1.5 text-xs font-medium text-muted-foreground shadow-none outline-none backdrop-blur hover:bg-white/80 focus-visible:!border-0 focus-visible:!ring-0"
          >
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
  const normalizedRouteSearch = routeSearch ?? "";
  const setupMode = getOnboardingSetupMode(normalizedRouteSearch);
  const selectedOrganizationId = resolveOnboardingOrganizationId(normalizedRouteSearch);
  const totalSteps = setupMode === "account" || !selectedOrganizationId ? 6 : 5;
  const providerKey =
    setupMode === "resume"
      ? selectedOrganizationId || "no-organization"
      : `${setupMode}-setup:${selectedOrganizationId || "no-organization"}`;

  return (
    <OnboardingProvider
      key={providerKey}
      initialState={
        shouldStartFreshOnboarding(normalizedRouteSearch)
          ? createFreshOnboardingInitialState()
          : undefined
      }
      totalSteps={totalSteps}
    >
      <OnboardingContent apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
    </OnboardingProvider>
  );
}

export default OnboardingPage;
