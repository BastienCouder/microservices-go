"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const words = ["chatgpt", "perplexity", "claude", "gemini", "mistral"] as const;

const modelIcons: Record<(typeof words)[number], string> = {
  chatgpt: "/models/openai.svg",
  perplexity: "/models/perplexity.svg",
  claude: "/models/anthropic.svg",
  gemini: "/models/google.svg",
  mistral: "/models/mistral.svg",
};

export function HeroSection() {
  const t = useTranslations("hero");
  const [isVisible, setIsVisible] = useState(false);
  const [wordIndex, setWordIndex] = useState(0);

  const stats = [
    { value: "<3 min", label: t("stats.firstResults") },
    { value: "10 LLMs", label: t("stats.tracked") },
    { value: "4 modules", label: t("stats.modules") },
    { value: "100%", label: t("stats.realData") },
  ];

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIndex((prev) => (prev + 1) % words.length);
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const activeWord = words[wordIndex];

  return (
    <section className="relative min-h-screen flex flex-col justify-center overflow-hidden">
      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12 py-24 sm:py-28 lg:py-40">
        <div className="mb-12">
          <h1
            className={`text-[clamp(2.5rem,11vw,7.5rem)] font-display leading-[0.9] tracking-tight transition-all duration-1000 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <span className="block">{t("title1")}</span>
            <span className="block">
              {t("title2")}{" "}
              <span className="relative inline-flex items-center gap-2 sm:gap-3">
                <span className="relative inline-block">
                  <span key={wordIndex} className="inline-flex items-center gap-1 sm:gap-3 lg:gap-3 lg:text-inherit">
                    <img alt={activeWord} className="h-6 w-6 opacity-80 sm:h-8 sm:w-8 lg:h-24 lg:w-24" src={modelIcons[activeWord]} />
                    {activeWord.split("").map((char, index) => (
                      <span
                        key={`${wordIndex}-${index}`}
                        className="inline-block animate-char-in text-primary"
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
                        {char}
                      </span>
                    ))}
                  </span>
                  <span className="absolute -bottom-2 left-0 right-0 h-3 bg-foreground/10" />
                </span>
              </span>
            </span>
          </h1>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 lg:gap-24 items-end">
          <p
            className={`text-xl lg:text-2xl text-muted-foreground leading-relaxed max-w-xl transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {t("description")}
          </p>

          <div
            className={`flex flex-col sm:flex-row items-start gap-4 transition-all duration-700 delay-300 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            <Button className="bg-primary hover:bg-primary/90 text-background px-8 h-14 text-base rounded-full group" size="lg">
              {t("startTrial")}
              <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
            </Button>
            <Button className="h-14 px-8 text-base rounded-full border-foreground/20 hover:bg-foreground/5" size="lg" variant="outline">
              {t("watchDemo")}
            </Button>
          </div>
        </div>
      </div>

      <div
        className={`lg:absolute lg:bottom-2 lg:left-0 lg:right-0 transition-all duration-700 delay-500 ${
          isVisible ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="marquee flex gap-10 whitespace-nowrap sm:gap-16" style={{ animationDuration: "30s" }}>
          {[...Array(2)].map((_, duplicateIndex) => (
            <div key={duplicateIndex} className="flex gap-10 sm:gap-16">
              {stats.map((stat) => (
                <div key={`${stat.value}-${duplicateIndex}`} className="flex items-baseline gap-3 sm:gap-4">
                  <span className="text-3xl sm:text-4xl lg:text-5xl font-display">{stat.value}</span>
                  <span className="text-sm text-muted-foreground">{stat.label}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
