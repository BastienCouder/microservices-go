"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  sectionCompactBodyClass,
  sectionCompactTitleClass,
  sectionHeadingClass,
  sectionHeadingMutedClass,
} from "./section-styles";

type Step = {
  number: string;
  title: string;
  description: string;
};

const HOW_IT_WORKS_STEP_DURATION_SECONDS = 25;
const HOW_IT_WORKS_STEP_DURATION_MS = HOW_IT_WORKS_STEP_DURATION_SECONDS * 1000;
const HOW_IT_WORKS_PROGRESS_ANIMATION = `progress ${HOW_IT_WORKS_STEP_DURATION_SECONDS}s linear forwards`;
const ONBOARDING_PHASE_DELAYS = [0.11, 0.23, 0.35, 0.49, 0.63, 0.77, 0.91] as const;
const ONBOARDING_PREVIEW_STEPS = [
  {
    label: "Site web",
    description: "VISIA renseigne la marque et le domaine.",
  },
  {
    label: "Profil de marque",
    description: "Le site est analysé pour préparer le profil.",
  },
  {
    label: "Intelligence de marque",
    description: "Le positionnement est généré et prêt à ajuster.",
  },
  {
    label: "Concurrents",
    description: "Les marques à comparer sont ajoutées.",
  },
  {
    label: "Prompts",
    description: "Les questions à suivre sont préparées.",
  },
  {
    label: "Analyse",
    description: "La première analyse de visibilité est prête.",
  },
] as const;

function AppOnboardingConnectPreview({ isActive }: { isActive: boolean }) {
  const [phase, setPhase] = useState(0);
  const onboardingStep = phase <= 2 ? 1 : Math.min(phase - 1, 6);
  const currentPreviewStep = ONBOARDING_PREVIEW_STEPS[onboardingStep - 1];

  useEffect(() => {
    if (!isActive) {
      setPhase(0);
      return;
    }

    setPhase(0);
    const timeouts = ONBOARDING_PHASE_DELAYS.map((delayRatio, index) =>
      window.setTimeout(
        () => setPhase(index + 1),
        HOW_IT_WORKS_STEP_DURATION_MS * delayRatio,
      ),
    );

    return () => {
      timeouts.forEach((timeout) => window.clearTimeout(timeout));
    };
  }, [isActive]);

  return (
    <div className="relative min-h-[560px] overflow-hidden bg-[radial-gradient(circle_at_top,_hsl(var(--primary)/0.08),_transparent_34%),linear-gradient(180deg,_#f8f9fc_0%,_#f1f3f8_100%)]">
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -left-12 top-12 h-36 w-36 rounded-full border border-primary/20" />
        <div className="absolute right-8 top-20 h-28 w-28 rounded-full border border-primary/15" />
        <div className="absolute bottom-10 left-1/3 h-40 w-40 rounded-full border border-primary/10" />
      </div>

      <div className="pointer-events-none absolute inset-x-0 top-4 z-10 flex justify-center px-4">
        <div className="flex max-w-[92%] flex-col items-center gap-2">
          <div className="rounded-full bg-zinc-200/90 p-1.5">
            <div className="flex items-center gap-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className={[
                    "h-2.5 rounded-full transition-all duration-350 ease-out",
                    index + 1 === onboardingStep
                      ? "w-3 bg-primary"
                      : index + 1 < onboardingStep
                        ? "w-8 bg-primary/75"
                        : "w-6 bg-white/80",
                  ].join(" ")}
                />
              ))}
            </div>
          </div>
          <div className="rounded-full border border-white/80 bg-white/90 px-3 py-1 text-center shadow-[0_10px_28px_rgba(15,23,42,0.08)] backdrop-blur">
            <span className="text-xs font-semibold text-primary">
              Étape {onboardingStep}/6 · {currentPreviewStep.label}
            </span>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {" "}
              — {currentPreviewStep.description}
            </span>
          </div>
        </div>
      </div>

      <div className="relative z-10 flex min-h-[560px] items-center px-4 pb-10 pt-24 sm:px-6 sm:pb-12 sm:pt-28 lg:px-10">
        <div className="mx-auto w-full max-w-[760px]">
          <div className="h-full min-h-[390px] w-full rounded-md border border-white/70 bg-white/95 shadow-none">
            {phase <= 2 ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
               

                <div className="space-y-4 px-6 pb-6">
                  <div className="space-y-1">
                    <div className="text-base font-bold">URL du site web</div>
                    <p className="text-sm text-muted-foreground">Saisissez le domaine racine</p>
                    <div className="relative flex h-10 w-full overflow-hidden rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs">
                      <div
                        className={`text-sm transition-all duration-500 ${
                          phase >= 2 ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                        }`}
                      >
                        visia.ai
                      </div>
                      {phase < 2 ? (
                        <span className="text-sm text-muted-foreground">exemple.com</span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end border-t border-border/70 p-6 pt-4">
                  <button
                    type="button"
                    className={`inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all duration-500 ${
                      phase >= 2 ? "opacity-100" : "opacity-50"
                    }`}
                  >
                    Continuer
                  </button>
                </div>
              </div>
            ) : null}

            {phase === 3 ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 p-6 duration-500">
                <div className="space-y-1.5">
                  <h3 className="text-2xl font-semibold leading-none tracking-tight">
                    Préparation de votre profil de marque
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Extraction des entités de marque et des catégories de service...
                  </p>
                </div>
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-sm font-medium text-primary">
                    <span>Analyse du site</span>
                    <span>78%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-primary/20">
                    <div className="h-full w-[78%] rounded-full bg-primary transition-all duration-700" />
                  </div>
                </div>
              </div>
            ) : null}

            {phase === 4 ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 p-6 duration-500">

                <div className="space-y-3">
                  {[
                    ["Nom de la marque", "VISIA"],
                    ["Description courte", "Plateforme de visibilité dans les réponses IA."],
                    ["Secteur", "Monitoring IA"],
                  ].map(([label, value]) => (
                    <div key={label} className="space-y-1">
                      <div className="text-base font-bold">{label}</div>
                      <div className="rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs">
                        {value}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {phase === 5 ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 p-6 duration-500">
                <div className="grid gap-2 sm:grid-cols-2">
                  {["Semrush", "Ahrefs", "Profound", "Peec AI"].map((competitor) => (
                    <div key={competitor} className="rounded-md border border-border/80 px-3 py-2 text-sm font-medium">
                      {competitor}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {phase === 6 ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 p-6 duration-500">
                <div className="space-y-2">
                  {[
                    "Quel outil choisir pour suivre sa visibilité dans ChatGPT ?",
                    "Quelles marques sont citées par les assistants IA ?",
                    "Comment optimiser mon contenu pour Perplexity ?",
                  ].map((prompt) => (
                    <div key={prompt} className="rounded-md border border-border/80 px-3 py-2 text-sm">
                      {prompt}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {phase >= 7 ? (
              <div className="animate-in fade-in slide-in-from-bottom-2 space-y-4 p-6 duration-500">
               
                <div className="space-y-3">
                  {["Concurrents comparés", "Prompts regroupés par intention", "Score de visibilité généré"].map((item) => (
                    <div key={item} className="flex items-center justify-between rounded-md border border-border/80 px-3 py-2 text-sm">
                      <span>{item}</span>
                      <span className="text-primary">Terminé</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  const t = useTranslations("howItWorks");
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const steps: Step[] = [
    {
      number: "01",
      title: t("steps.0.title"),
      description: t("steps.0.description"),
    },
    {
      number: "02",
      title: t("steps.1.title"),
      description: t("steps.1.description"),
    },
    {
      number: "03",
      title: t("steps.2.title"),
      description: t("steps.2.description"),
    },
    {
      number: "04",
      title: t("steps.3.title"),
      description: t("steps.3.description"),
    },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setIsVisible(true);
      }
    }, { threshold: 0.1 });

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, HOW_IT_WORKS_STEP_DURATION_MS);

    return () => window.clearTimeout(timeout);
  }, [activeStep, steps.length]);

  return (
    <section id="how-it-works" ref={sectionRef} className="relative bg-background text-primary overflow-hidden py-16 sm:py-20 lg:py-28">
     {/*   <div className="absolute inset-0 opacity-[0.03] text-primary pointer-events-none">
       <div
          className="absolute inset-0"
          style={{
            backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            currentColor 40px,
            currentColor 41px
          )`,
          }}
        />
      </div> */}

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-24">
          <h2
            className={`${sectionHeadingClass} transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {t("headline.title")}
            <br />
            <span className={sectionHeadingMutedClass}>{t("headline.subtitle")}</span>
          </h2>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
          <div className="space-y-0 order-2 lg:order-1">
            {steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`w-full text-left py-5 sm:py-6 lg:py-8 border-b border-foreground/10 transition-all duration-500 group ${
                  activeStep === index ? "opacity-100" : "opacity-40 hover:opacity-70"
                }`}
              >
                <div className="flex items-start gap-4 lg:gap-6">
                  <span className="font-display text-2xl lg:text-3xl text-primary">{step.number}</span>
                  <div className="flex-1">
                    <h3 className={`${sectionCompactTitleClass} mb-2 lg:mb-3 group-hover:translate-x-2 transition-transform duration-300`}>
                      {step.title}
                    </h3>
                    <p className={`${sectionCompactBodyClass} text-foreground/60`}>{step.description}</p>

                    {activeStep === index ? (
                      <div className="mt-3 lg:mt-4 h-px bg-foreground/20 overflow-hidden">
                        <div
                          className="h-full bg-primary w-0"
                          style={{
                            animation: HOW_IT_WORKS_PROGRESS_ANIMATION,
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="order-1 lg:order-2 lg:sticky lg:top-32 self-start mb-8 lg:mb-0">
            <div className="overflow-hidden rounded-lg border border-foreground/10 bg-background shadow-[0_24px_80px_hsl(var(--primary)/0.08)]">
              {activeStep === 0 ? (
                <AppOnboardingConnectPreview isActive={activeStep === 0} />
              ) : (
                <>
                  <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-foreground/10 flex items-center justify-between">
                    <div className="flex gap-2">
                      <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-foreground/20" />
                      <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-foreground/20" />
                      <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-foreground/20" />
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                      <span className="text-xs font-mono text-foreground/40">{t("status")}</span>
                    </div>
                  </div>
                  <div className="min-h-[560px] bg-background" />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from {
            width: 0%;
          }
          to {
            width: 100%;
          }
        }
      `}</style>
    </section>

    
  );
}
