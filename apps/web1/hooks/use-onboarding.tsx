"use client";

import React, { createContext, useContext, useState, ReactNode } from "react";

export type PromptWithLanguage = {
    text: string;
    language: string;
    category?: "organic" | "brand_specific";
    intent?: "commercial" | "informational" | "transactional" | "branded";
};

export type CompetitorItem = {
    name: string;
    website: string;
    logo?: string;
};

export type OnboardingState = {
    step: number;
    websiteUrl: string;
    brandName: string;
    brandShortDescription: string;
    brandDescription: string;
    industry: string;
    keyFeatures: string[];
    brandPersonas: string[]; // Renamed from personas to be clear it's brand target personas
    competitors: CompetitorItem[];
    selectedPrompts: PromptWithLanguage[];
    selectedModels: string[];
};

type OnboardingContextType = OnboardingState & {
    totalSteps: number;
    brandPreparationCompleted: boolean;
    setStep: (step: number) => void;
    setWebsiteUrl: (url: string) => void;
    setBrandName: (name: string) => void;
    setBrandShortDescription: (desc: string) => void;
    setBrandDescription: (desc: string) => void;
    setIndustry: (industry: string) => void;
    setKeyFeatures: (features: string[]) => void;
    setBrandPersonas: (personas: string[]) => void;
    setCompetitors: (competitors: CompetitorItem[]) => void;
    setSelectedPrompts: (prompts: PromptWithLanguage[]) => void;
    setSelectedModels: (models: string[]) => void;
    setBrandPreparationCompleted: (value: boolean) => void;
    nextStep: () => void;
    prevStep: () => void;
};

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined);

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
    step: 1,
    websiteUrl: "",
    brandName: "",
    brandShortDescription: "",
    brandDescription: "",
    industry: "",
    keyFeatures: [],
    brandPersonas: [],
    competitors: [],
    selectedPrompts: [],
    selectedModels: ["gpt-4o", "perplexity", "gemini-pro"],
};

export const OnboardingProvider = ({
    children,
    initialState,
    totalSteps = 6,
}: {
    children: ReactNode;
    initialState?: Partial<OnboardingState>;
    totalSteps?: number;
}) => {
    const mergedState = { ...DEFAULT_ONBOARDING_STATE, ...initialState };

    const [step, setStep] = useState(mergedState.step);
    const [websiteUrl, setWebsiteUrl] = useState(mergedState.websiteUrl);
    const [brandName, setBrandName] = useState(mergedState.brandName);
    const [brandShortDescription, setBrandShortDescription] = useState(mergedState.brandShortDescription);
    const [brandDescription, setBrandDescription] = useState(mergedState.brandDescription);
    const [industry, setIndustry] = useState(mergedState.industry);
    const [keyFeatures, setKeyFeatures] = useState<string[]>(mergedState.keyFeatures);
    const [brandPersonas, setBrandPersonas] = useState<string[]>(mergedState.brandPersonas);
    const [competitors, setCompetitors] = useState<CompetitorItem[]>(mergedState.competitors);
    const [selectedPrompts, setSelectedPrompts] = useState<PromptWithLanguage[]>(mergedState.selectedPrompts);
    const [selectedModels, setSelectedModels] = useState<string[]>(mergedState.selectedModels);
    const [brandPreparationCompleted, setBrandPreparationCompleted] = useState(false);

    const nextStep = () => setStep((prev) => Math.min(prev + 1, totalSteps));
    const prevStep = () => setStep((prev) => Math.max(prev - 1, 1));

    return (
        <OnboardingContext.Provider
            value={{
                step,
                totalSteps,
                brandPreparationCompleted,
                setStep,
                websiteUrl,
                setWebsiteUrl,
                brandName,
                setBrandName,
                brandShortDescription,
                setBrandShortDescription,
                brandDescription,
                setBrandDescription,
                industry,
                setIndustry,
                keyFeatures,
                setKeyFeatures,
                brandPersonas,
                setBrandPersonas,
                competitors,
                setCompetitors,
                selectedPrompts,
                setSelectedPrompts,
                selectedModels,
                setSelectedModels,
                setBrandPreparationCompleted,
                nextStep,
                prevStep,
            }}
        >
            {children}
        </OnboardingContext.Provider>
    );
};

export const useOnboarding = () => {
    const context = useContext(OnboardingContext);
    if (!context) {
        throw new Error("useOnboarding must be used within an OnboardingProvider");
    }
    return context;
};
