"use client";

import { useEffect, useRef } from "react";
import { useOnboarding, OnboardingProvider } from "@/hooks/use-onboarding";
import { OnboardingLeftPanel } from "@/app/onboarding/left-panel";
import { StepWebsite } from "@/app/onboarding/step-website";
import { StepBrand } from "@/app/onboarding/step-brand";
import { StepCompetitors } from "@/app/onboarding/step-competitors";
import { StepPrompts } from "@/app/onboarding/step-prompts";
import { StepModels } from "@/app/onboarding/step-models";
import { StepAnalysis } from "@/app/onboarding/step-analysis";
import { StepProgress } from "@/app/onboarding/step-progress";

function OnboardingContent() {
    const { step } = useOnboarding();
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    const steps = [
        { component: <StepWebsite />, id: 1 },
        { component: <StepBrand />, id: 2 },
        { component: <StepCompetitors />, id: 3 },
        { component: <StepPrompts />, id: 4 },
        { component: <StepModels />, id: 5 },
        { component: <StepAnalysis />, id: 6 },
    ];

    useEffect(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }, [step]);

    return (
        <div className="flex min-h-screen bg-zinc-100/60 lg:h-screen lg:overflow-hidden">
            <OnboardingLeftPanel />

            <section className="relative min-w-0 flex-1 bg-zinc-100/60">
                <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
                    <StepProgress step={step} total={steps.length} />
                </div>

                <div ref={scrollContainerRef} className="h-full overflow-y-auto">
                    <div className="mx-auto w-full max-w-4xl px-4 pt-14 pb-14 sm:px-6 sm:pt-16 sm:pb-16">
                        <div className="mx-auto w-full max-w-[760px]">
                            {steps[step - 1]?.component}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function OnboardingPage() {
    return (
        <OnboardingProvider totalSteps={6}>
            <OnboardingContent />
        </OnboardingProvider>
    );
}
