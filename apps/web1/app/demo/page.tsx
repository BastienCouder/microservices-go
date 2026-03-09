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
import { DEMO_INITIAL_STATE } from "@/components/onboarding/demo-data";
import { StepProgress } from "@/app/onboarding/step-progress";

function DemoContent() {
    const { step } = useOnboarding();
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    const steps = [
        { component: <StepWebsite isDemo />, id: 1 },
        { component: <StepBrand />, id: 2 },
        { component: <StepCompetitors />, id: 3 },
        { component: <StepPrompts />, id: 4 },
        { component: <StepModels nextLabel="Run Demo Audit" />, id: 5 },
        { component: <StepAnalysis />, id: 6 },
    ];

    useEffect(() => {
        scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" });
    }, [step]);

    return (
        <div className="flex min-h-screen bg-zinc-100/60 lg:h-screen lg:overflow-hidden">
            <OnboardingLeftPanel />

            <section className="min-w-0 flex-1 bg-zinc-100/60">

                <div ref={scrollContainerRef} className="md:h-[calc(100vh)] overflow-y-auto">
                    <div className="z-30 flex justify-center py-6">
                        <StepProgress step={step} total={steps.length} />
                    </div>
                    <div className="mx-auto w-full max-w-4xl md:px-4 sm:px-6 sm:pt-2 sm:pb-8">
                        <div className="mx-auto w-full max-w-[760px]">
                            {steps[step - 1]?.component}
                        </div>
                    </div>
                </div>
            </section>
        </div>
    );
}

export default function DemoPage() {
    return (
        <OnboardingProvider
            totalSteps={6}
            initialState={{ ...DEMO_INITIAL_STATE, step: 1, brandName: "", websiteUrl: "" }}
        >
            <DemoContent />
        </OnboardingProvider>
    );
}
