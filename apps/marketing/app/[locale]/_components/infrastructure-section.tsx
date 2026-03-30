"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  sectionHeadingClass,
  sectionIntroTextClass,
} from "./section-styles";

type LLM = {
  name: string;
  icon: string;
};

export function InfrastructureSection() {
  const t = useTranslations("infrastructure");
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  const llms: LLM[] = [
    { name: "ChatGPT", icon: "/models/openai.svg" },
    { name: "Perplexity", icon: "/models/perplexity.svg" },
    { name: "Claude", icon: "/models/anthropic.svg" },
    { name: "Gemini", icon: "/models/google.svg" },
    { name: "Grok", icon: "/models/grok.svg" },
    { name: "Copilot", icon: "/models/copilot.svg" },
    { name: "DeepSeek", icon: "/models/deepseek.svg" },
    { name: "Mistral", icon: "/models/mistral.svg" },
    { name: "Meta AI", icon: "/models/meta.svg" },
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
      setActiveIndex((prev) => (prev + 1) % llms.length);
    }, 2000);

    return () => clearInterval(interval);
  }, [llms.length]);

  return (
    <section ref={sectionRef} className="relative py-16 sm:py-20 lg:py-28 overflow-hidden bg-background">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <h2 className={`${sectionHeadingClass} mb-8`}>
              {t("headline.line1")}
              <br />
              <span className="text-muted-foreground">{t("headline.line2")}</span>
            </h2>
            <p className={`${sectionIntroTextClass} mb-12 max-w-xl`}>{t("description")}</p>

            <div className="grid grid-cols-1 gap-4 border-t border-foreground/10 pt-8 sm:grid-cols-3 sm:gap-8 sm:pt-12">
              <div className="flex items-end justify-between gap-4 border-b border-foreground/10 pb-4 sm:block sm:border-b-0 sm:pb-0">
                <div className="text-4xl lg:text-5xl font-display">9</div>
                <div className="text-right text-xs sm:text-left sm:text-sm text-primary uppercase font-mono">{t("stats.covered")}</div>
              </div>
              <div className="flex items-end justify-between gap-4 border-b border-foreground/10 pb-4 sm:block sm:border-b-0 sm:pb-0">
                <div className="text-4xl lg:text-5xl font-display">99,9%</div>
                <div className="text-right text-xs sm:text-left sm:text-sm text-primary uppercase font-mono">{t("stats.uptime")}</div>
              </div>
              <div className="flex items-end justify-between gap-4 pb-1 sm:block sm:pb-0">
                <div className="text-4xl lg:text-5xl font-display">&lt;50ms</div>
                <div className="text-right text-xs sm:text-left sm:text-sm text-primary uppercase font-mono">{t("stats.responseTime")}</div>
              </div>
            </div>
          </div>

          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="rounded-lg border border-foreground/10 bg-primary/[0.05] backdrop-blur-sm">
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-primary uppercase tracking-widest">{t("panel.allLlms")}</span>
                <span className="flex items-center gap-2 text-xs font-mono text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  {t("panel.liveMonitoring")}
                </span>
              </div>

              <div className="grid grid-cols-1">
                {llms.map((llm, index) => (
                  <div
                    key={llm.name}
                    className={`px-6 py-4 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-500 ${
                      activeIndex === index ? "bg-primary/[0.04]" : "bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-8 h-8 flex items-center justify-center transition-colors duration-300 ${
                          activeIndex === index ? "text-foreground" : "text-muted-foreground/40"
                        }`}
                      >
                        <img src={llm.icon} alt={llm.name} className="w-5 h-5" />
                      </div>

                      <div className={`font-medium transition-colors duration-300 ${activeIndex === index ? "text-foreground" : "text-muted-foreground"}`}>
                        {llm.name}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
