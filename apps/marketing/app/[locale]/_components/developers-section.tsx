"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, ExternalLink } from "lucide-react";
import {
  sectionCompactBodyClass,
  sectionHeadingClass,
  sectionHeadingMutedClass,
  sectionIntroTextClass,
} from "./section-styles";

type Example = {
  label: string;
  code: string;
};

export function DevelopersSection() {
  const t = useTranslations("developers");
  const [activeTab, setActiveTab] = useState(0);
  const [copied, setCopied] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const codeExamples: Example[] = [
    {
      label: t("examples.rest.label"),
      code: t.raw("examples.rest.code") as string,
    },
    {
      label: t("examples.mcp.label"),
      code: t.raw("examples.mcp.code") as string,
    },
    {
      label: t("examples.webhooks.label"),
      code: t.raw("examples.webhooks.code") as string,
    },
  ];

  const features = [
    {
      title: t("features.api.title"),
      description: t("features.api.description"),
    },
    {
      title: t("features.mcp.title"),
      description: t("features.mcp.description"),
    },
    {
      title: t("features.webhooks.title"),
      description: t("features.webhooks.description"),
    },
    {
      title: t("features.export.title"),
      description: t("features.export.description"),
    },
    {
      title: t("features.docs.title"),
      description: t("features.docs.description"),
    },
  ];

  const codeAnimationStyles = `
  .dev-code-line {
    opacity: 0;
    transform: translateX(-8px);
    animation: devLineReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes devLineReveal {
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }

  .dev-code-char {
    opacity: 0;
    filter: blur(8px);
    animation: devCharReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }

  @keyframes devCharReveal {
    to {
      opacity: 1;
      filter: blur(0);
    }
  }
`;

  const handleCopy = () => {
    navigator.clipboard.writeText(codeExamples[activeTab].code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

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

  return (
    <section id="developers" ref={sectionRef} className="relative py-16 sm:py-20 lg:py-28 overflow-hidden bg-background">
      <style dangerouslySetInnerHTML={{ __html: codeAnimationStyles }} />
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-start">
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
            }`}
          >
            <h2 className={`${sectionHeadingClass} mb-8`}>
              <span className="block">{t("headline.title")}</span>
              <span className={`mt-2 block max-w-[10ch] lg:max-w-none ${sectionHeadingMutedClass}`}>{t("headline.subtitle")}</span>
            </h2>
            <p className={`${sectionIntroTextClass} mb-12 max-w-xl`}>{t("description")}</p>

            <div className="grid sm:grid-cols-2 gap-x-8 gap-y-10">
              {features.map((feature, index) => (
                <div
                  key={feature.title}
                  className={`transition-all duration-500 ${
                    isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                  }`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  <h3 className="font-mono text-sm font-bold text-primary mb-2 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    {feature.title}
                  </h3>
                  <p className={sectionCompactBodyClass}>{feature.description}</p>
                </div>
              ))}
            </div>
          </div>

          <div
            className={`hidden md:block  lg:sticky lg:top-32 transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="border border-foreground/10 bg-primary/[0.02] backdrop-blur-sm rounded-lg">
              <div className="flex items-center border-b border-primary/10 overflow-x-auto no-scrollbar">
                {codeExamples.map((example, index) => (
                  <button
                    key={example.label}
                    type="button"
                    onClick={() => setActiveTab(index)}
                    className={`px-4 py-3 text-[11px] sm:px-6 sm:py-4 sm:text-xs font-mono transition-colors relative whitespace-nowrap ${
                      activeTab === index ? "text-primary bg-primary/[0.03]" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {example.label}
                    {activeTab === index ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" /> : null}
                  </button>
                ))}
                <div className="flex-1 min-w-[20px]" />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-3 py-3 text-primary hover:text-foreground transition-colors border-l border-foreground/10 sm:px-4 sm:py-4"
                >
                  {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>

              <div className="min-h-[220px] overflow-x-auto bg-background p-4 font-mono text-xs sm:min-h-[300px] sm:p-6 sm:text-sm lg:p-8">
                <pre className="text-foreground/80">
                  {codeExamples[activeTab].code.split("\n").map((line, lineIndex) => (
                    <div
                      key={`${activeTab}-${lineIndex}`}
                      className="dev-code-line leading-relaxed sm:leading-loose"
                      style={{ animationDelay: `${lineIndex * 50}ms` }}
                    >
                      <span className="mr-2 inline-block w-3 select-none text-[10px] text-foreground/30 sm:mr-4 sm:w-4 sm:text-inherit">
                        {lineIndex + 1}
                      </span>
                      <span className="inline-flex">
                        {line.split("").map((char, charIndex) => (
                          <span
                            key={`${activeTab}-${lineIndex}-${charIndex}`}
                            className="dev-code-char"
                            style={{ animationDelay: `${lineIndex * 50 + charIndex * 10}ms` }}
                          >
                            {char === " " ? "\u00A0" : char}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </pre>
              </div>

              <div className="px-6 py-3 border-t border-foreground/10 bg-background/[0.02] flex items-center justify-between">
                <div />
                <div className="text-[10px] font-mono text-green-600 flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-green-500" />
                  {t("status")}
                </div>
              </div>
            </div>

            <div className="mt-8 flex items-center gap-8 text-sm font-medium">
              <a href="#" className="inline-flex items-center gap-2 text-foreground hover:underline underline-offset-4 decoration-1">
                {t("docsLink")}
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
