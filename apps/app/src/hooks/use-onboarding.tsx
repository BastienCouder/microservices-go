"use client";

import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
  useState,
} from "react";

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
  attributionSource: string;
  brandName: string;
  brandShortDescription: string;
  brandDescription: string;
  industry: string;
  keyFeatures: string[];
  brandPersonas: string[];
  competitors: CompetitorItem[];
  selectedPrompts: PromptWithLanguage[];
  selectedModels: string[];
};

type OnboardingContextValue = OnboardingState & {
  totalSteps: number;
  brandPreparationCompleted: boolean;
  setStep: (step: number) => void;
  setWebsiteUrl: (url: string) => void;
  setAttributionSource: (source: string) => void;
  setBrandName: (name: string) => void;
  setBrandShortDescription: (description: string) => void;
  setBrandDescription: (description: string) => void;
  setIndustry: (industry: string) => void;
  setKeyFeatures: (features: string[]) => void;
  setBrandPersonas: (personas: string[]) => void;
  setCompetitors: (competitors: CompetitorItem[]) => void;
  setSelectedPrompts: (prompts: PromptWithLanguage[]) => void;
  setSelectedModels: (modelIds: string[]) => void;
  setBrandPreparationCompleted: (value: boolean) => void;
  nextStep: () => void;
  prevStep: () => void;
};

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  step: 1,
  websiteUrl: "",
  attributionSource: "",
  brandName: "",
  brandShortDescription: "",
  brandDescription: "",
  industry: "",
  keyFeatures: [],
  brandPersonas: [],
  competitors: [],
  selectedPrompts: [],
  selectedModels: [],
};

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

type OnboardingProviderProps = {
  children: ReactNode;
  initialState?: Partial<OnboardingState>;
  totalSteps?: number;
};

export function OnboardingProvider({
  children,
  initialState,
  totalSteps = 6,
}: OnboardingProviderProps) {
  const mergedState = useMemo(
    () => ({ ...DEFAULT_ONBOARDING_STATE, ...initialState }),
    [initialState],
  );

  const [step, setStep] = useState(mergedState.step);
  const [websiteUrl, setWebsiteUrl] = useState(mergedState.websiteUrl);
  const [attributionSource, setAttributionSource] = useState(
    mergedState.attributionSource,
  );
  const [brandName, setBrandName] = useState(mergedState.brandName);
  const [brandShortDescription, setBrandShortDescription] = useState(
    mergedState.brandShortDescription,
  );
  const [brandDescription, setBrandDescription] = useState(
    mergedState.brandDescription,
  );
  const [industry, setIndustry] = useState(mergedState.industry);
  const [keyFeatures, setKeyFeatures] = useState<string[]>(
    mergedState.keyFeatures,
  );
  const [brandPersonas, setBrandPersonas] = useState<string[]>(
    mergedState.brandPersonas,
  );
  const [competitors, setCompetitors] = useState<CompetitorItem[]>(
    mergedState.competitors,
  );
  const [selectedPrompts, setSelectedPrompts] = useState<PromptWithLanguage[]>(
    mergedState.selectedPrompts,
  );
  const [selectedModels, setSelectedModels] = useState<string[]>(
    mergedState.selectedModels,
  );
  const [brandPreparationCompleted, setBrandPreparationCompleted] =
    useState(false);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      step,
      websiteUrl,
      attributionSource,
      brandName,
      brandShortDescription,
      brandDescription,
      industry,
      keyFeatures,
      brandPersonas,
      competitors,
      selectedPrompts,
      selectedModels,
      totalSteps,
      brandPreparationCompleted,
      setStep,
      setWebsiteUrl,
      setAttributionSource,
      setBrandName,
      setBrandShortDescription,
      setBrandDescription,
      setIndustry,
      setKeyFeatures,
      setBrandPersonas,
      setCompetitors,
      setSelectedPrompts,
      setSelectedModels,
      setBrandPreparationCompleted,
      nextStep: () => setStep((current) => Math.min(current + 1, totalSteps)),
      prevStep: () => setStep((current) => Math.max(current - 1, 1)),
    }),
    [
      brandDescription,
      brandName,
      brandPersonas,
      brandPreparationCompleted,
      brandShortDescription,
      competitors,
      attributionSource,
      industry,
      keyFeatures,
      selectedModels,
      selectedPrompts,
      step,
      totalSteps,
      websiteUrl,
    ],
  );

  return (
    <OnboardingContext.Provider value={value}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  const context = useContext(OnboardingContext);
  if (!context) {
    throw new Error("useOnboarding must be used within an OnboardingProvider");
  }
  return context;
}
