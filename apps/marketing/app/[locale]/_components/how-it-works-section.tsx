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
    const interval = setInterval(() => {
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [steps.length]);

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
                            animation: "progress 5s linear forwards",
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
            <div className="border border-foreground/10 overflow-hidden">
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
