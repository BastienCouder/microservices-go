"use client";

import {
  createContext,
  type ReactNode,
  useEffect,
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
  organizationName: string;
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
  setOrganizationName: (name: string) => void;
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

type PersistedOnboardingState = Partial<OnboardingState> & {
  brandPreparationCompleted?: boolean;
};

export type OnboardingInitialState = PersistedOnboardingState;

const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  step: 1,
  organizationName: "",
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

const ONBOARDING_STORAGE_KEY = "app:onboarding-state";

const OnboardingContext = createContext<OnboardingContextValue | null>(null);

type OnboardingProviderProps = {
  children: ReactNode;
  initialState?: OnboardingInitialState;
  totalSteps?: number;
};

function clampStep(step: number, totalSteps: number): number {
  return Math.min(Math.max(step, 1), totalSteps);
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string")
  );
}

function isPromptWithLanguage(value: unknown): value is PromptWithLanguage {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as PromptWithLanguage).text === "string" &&
    typeof (value as PromptWithLanguage).language === "string"
  );
}

function isCompetitorItem(value: unknown): value is CompetitorItem {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as CompetitorItem).name === "string" &&
    typeof (value as CompetitorItem).website === "string"
  );
}

export function sanitizePersistedOnboardingState(
  value: unknown,
): PersistedOnboardingState {
  if (typeof value !== "object" || value === null) {
    return {};
  }

  const record = value as Record<string, unknown>;

  return {
    step:
      typeof record.step === "number" && Number.isFinite(record.step)
        ? record.step
        : undefined,
    organizationName:
      typeof record.organizationName === "string"
        ? record.organizationName
        : undefined,
    websiteUrl:
      typeof record.websiteUrl === "string" ? record.websiteUrl : undefined,
    attributionSource:
      typeof record.attributionSource === "string"
        ? record.attributionSource
        : undefined,
    brandName: typeof record.brandName === "string" ? record.brandName : undefined,
    brandShortDescription:
      typeof record.brandShortDescription === "string"
        ? record.brandShortDescription
        : undefined,
    brandDescription:
      typeof record.brandDescription === "string"
        ? record.brandDescription
        : undefined,
    industry: typeof record.industry === "string" ? record.industry : undefined,
    keyFeatures: isStringArray(record.keyFeatures) ? record.keyFeatures : undefined,
    brandPersonas: isStringArray(record.brandPersonas)
      ? record.brandPersonas
      : undefined,
    competitors: Array.isArray(record.competitors)
      ? record.competitors.filter(isCompetitorItem)
      : undefined,
    selectedPrompts: Array.isArray(record.selectedPrompts)
      ? record.selectedPrompts.filter(isPromptWithLanguage)
      : undefined,
    selectedModels: isStringArray(record.selectedModels)
      ? record.selectedModels
      : undefined,
    brandPreparationCompleted:
      typeof record.brandPreparationCompleted === "boolean"
        ? record.brandPreparationCompleted
        : undefined,
  };
}

export function getPersistedOnboardingState(): PersistedOnboardingState {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const rawValue = window.sessionStorage.getItem(ONBOARDING_STORAGE_KEY);
    if (!rawValue) {
      return {};
    }

    return sanitizePersistedOnboardingState(JSON.parse(rawValue));
  } catch {
    return {};
  }
}

export function clearPersistedOnboardingState(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.sessionStorage.removeItem(ONBOARDING_STORAGE_KEY);
  } catch {
    // Ignore storage cleanup failures and keep the current in-memory state.
  }
}

export function OnboardingProvider({
  children,
  initialState,
  totalSteps = 6,
}: OnboardingProviderProps) {
  const mergedState = useMemo(
    () => ({
      ...DEFAULT_ONBOARDING_STATE,
      ...getPersistedOnboardingState(),
      ...initialState,
    }),
    [initialState],
  );

  const [step, setStep] = useState(clampStep(mergedState.step, totalSteps));
  const [organizationName, setOrganizationName] = useState(
    mergedState.organizationName,
  );
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
    useState(Boolean(mergedState.brandPreparationCompleted));

  useEffect(() => {
    setStep((current) => clampStep(current, totalSteps));
  }, [totalSteps]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const persistedState: PersistedOnboardingState = {
      step,
      organizationName,
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
      brandPreparationCompleted,
    };

    try {
      window.sessionStorage.setItem(
        ONBOARDING_STORAGE_KEY,
        JSON.stringify(persistedState),
      );
    } catch {
      // Ignore storage write failures and keep the current in-memory state.
    }
  }, [
    attributionSource,
    brandDescription,
    brandName,
    brandPersonas,
    brandPreparationCompleted,
    brandShortDescription,
    competitors,
    industry,
    keyFeatures,
    organizationName,
    selectedModels,
    selectedPrompts,
    step,
    websiteUrl,
  ]);

  const value = useMemo<OnboardingContextValue>(
    () => ({
      step,
      organizationName,
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
      setOrganizationName,
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
      organizationName,
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
