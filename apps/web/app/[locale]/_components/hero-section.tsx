"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import {
  getSectionRevealClass,
  sectionRevealDelayMdClass,
  sectionRevealDelayLgClass,
} from "./section-styles";

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
  const appURL =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:30004";

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
    <section className="relative flex flex-col justify-center overflow-hidden">
      <div className="relative z-10 mx-auto max-w-[1400px] px-6 pb-8 pt-32 sm:px-8 sm:pt-36 md:pt-40 lg:px-12 lg:pt-44">
        <div className="mb-10 sm:mb-12 lg:mb-14">
          <h1
            className={`text-[clamp(3.4rem,12vw,7.5rem)] font-display leading-[0.92] tracking-tight sm:text-[clamp(4.2rem,11vw,7.5rem)] ${getSectionRevealClass(isVisible)}`}
          >
            <span className="block">{t("title1")}</span>
            <span className="block">
              {t("title2")}{" "}
              <span className="relative inline-flex items-center gap-2 sm:gap-3">
                <span className="relative inline-block">
                  <span key={wordIndex} className="inline-flex items-center gap-2 sm:gap-3 lg:gap-3 lg:text-inherit">
                    <img
                      alt={activeWord}
                      className="h-8 w-8 opacity-80 sm:h-10 sm:w-10 md:h-12 md:w-12 lg:h-24 lg:w-24"
                      src={modelIcons[activeWord]}
                    />
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
                  <span className="absolute -bottom-1.5 left-0 right-0 h-2 bg-foreground/10 sm:-bottom-2 sm:h-3" />
                </span>
              </span>
            </span>
          </h1>
        </div>

        <div className="grid items-end gap-8 lg:grid-cols-2 lg:gap-24">
          <p
            className={`max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl lg:text-2xl ${getSectionRevealClass(isVisible, "up", "sm")} ${sectionRevealDelayMdClass}`}
          >
            {t("description")}
          </p>

          <div
            className={`flex flex-col items-stretch gap-4 sm:flex-row sm:items-start ${getSectionRevealClass(isVisible, "up", "sm")} ${sectionRevealDelayLgClass}`}
          >
            <Button
              asChild
              className="h-14 rounded-full bg-primary px-8 text-base text-background group hover:bg-primary/90 sm:w-auto"
              size="lg"
            >
              <a href={appURL}>
                {t("startTrial")}
                <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
              </a>
            </Button>
            <Button className="h-14 rounded-full border-foreground/20 px-8 text-base hover:bg-foreground/5 sm:w-auto" size="lg" variant="outline">
              {t("watchDemo")}
            </Button>
          </div>
        </div>
      </div>

      {/* <div
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
      </div> */}
    </section>
  );
}
