"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  sectionFeatureBodyClass,
  sectionFeatureTitleClass,
  sectionHeadingClass,
  sectionHeadingMutedClass,
} from "./section-styles";

type Feature = {
  number: string;
  title: string;
  description: string;
  visual: "deploy" | "ai" | "collab" | "security";
};

export function FeaturesSection() {
  const t = useTranslations("features");
  const features: Feature[] = [
    {
      number: "01",
      title: t("items.0.title"),
      description: t("items.0.description"),
      visual: "deploy",
    },
    {
      number: "02",
      title: t("items.1.title"),
      description: t("items.1.description"),
      visual: "ai",
    },
    {
      number: "03",
      title: t("items.2.title"),
      description: t("items.2.description"),
      visual: "collab",
    },
    {
      number: "04",
      title: t("items.3.title"),
      description: t("items.3.description"),
      visual: "security",
    },
  ];

  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

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
    <section id="features" ref={sectionRef} className="relative py-16 sm:py-20 lg:py-28">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="mb-16 lg:mb-24">
          <h2
            className={`${sectionHeadingClass} transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            {t("title")}
            <br />
            <span className={sectionHeadingMutedClass}>{t("subtitle")}</span>
          </h2>
        </div>

        <div>
          {features.map((feature, index) => (
            <FeatureCard key={feature.number} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function DeployVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <defs>
        <clipPath id="deployClip">
          <rect x="30" y="20" width="140" height="120" rx="4" />
        </clipPath>
      </defs>
      <rect x="30" y="20" width="140" height="120" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
      <g clipPath="url(#deployClip)">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x="40"
            y={35 + i * 16}
            width="120"
            height="10"
            rx="2"
            fill="currentColor"
            opacity="0.15"
          >
            <animate attributeName="opacity" values="0.15;0.8;0.15" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
            <animate attributeName="width" values="20;120;20" dur="2s" begin={`${i * 0.15}s`} repeatCount="indefinite" />
          </rect>
        ))}
      </g>
      <circle cx="100" cy="155" r="3" fill="currentColor" opacity="0.3">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

function AIVisual() {
  const llmLogos = [
    { src: "/models/openai.svg" },
    { src: "/models/perplexity.svg" },
    { src: "/models/google.svg" },
    { src: "/models/anthropic.svg" },
    { src: "/models/copilot.svg" },
    { src: "/models/mistral.svg" },
  ];

  const radius = 95;

  return (
    <svg viewBox="-20 0 280 220" className="w-52 h-52 md:w-60 md:h-60">
      <circle cx="100" cy="80" r="30" fill="none" stroke="currentColor" strokeWidth="1" opacity="0">
        <animate attributeName="r" values="25;85" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
      </circle>

      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = i * 60 * (Math.PI / 180);
        const x = 100 + Math.cos(angle) * radius;
        const y = 80 + Math.sin(angle) * radius;

        return (
          <line key={`line-${i}`} x1="100" y1="80" x2={x} y2={y} stroke="currentColor" strokeWidth="1" opacity="0.3">
            <animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
          </line>
        );
      })}

      {[0, 1, 2, 3, 4, 5].map((i) => {
        const angle = i * 60 * (Math.PI / 180);
        const x = 100 + Math.cos(angle) * radius;
        const y = 80 + Math.sin(angle) * radius;

        return (
          <g key={`logo-${i}`} transform={`translate(${x}, ${y})`}>
            <circle r="20" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4" />
            <image href={llmLogos[i].src} x="-12" y="-12" width="24" height="24" className="opacity-95">
              <animate attributeName="opacity" values="0.8;1;0.8" dur="2s" begin={`${i * 0.3}s`} repeatCount="indefinite" />
            </image>
          </g>
        );
      })}

      <g transform="translate(100, 80)">
        <circle r="22" fill="white" stroke="currentColor" strokeWidth="2" />
        <g transform="translate(-14, -14) scale(1)">
          <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="2.5" />
          <line x1="19" y1="19" x2="24" y2="24" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </g>
    </svg>
  );
}

function CollabVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <g>
        <rect x="30" y="50" width="50" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="55" y="85" textAnchor="middle" fontSize="20" fontFamily="monospace" fill="currentColor">
          A
        </text>
        <circle cx="55" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>

      <g>
        <rect x="120" y="50" width="50" height="60" rx="4" fill="none" stroke="currentColor" strokeWidth="2" />
        <text x="145" y="85" textAnchor="middle" fontSize="20" fontFamily="monospace" fill="currentColor">
          B
        </text>
        <circle cx="145" cy="35" r="12" fill="none" stroke="currentColor" strokeWidth="2" />
      </g>

      <line x1="80" y1="80" x2="120" y2="80" stroke="currentColor" strokeWidth="2" strokeDasharray="4 4">
        <animate attributeName="stroke-dashoffset" values="0;-8" dur="0.5s" repeatCount="indefinite" />
      </line>

      <circle r="4" fill="currentColor">
        <animateMotion dur="1.5s" repeatCount="indefinite">
          <mpath href="#dataPath" />
        </animateMotion>
      </circle>
      <path id="dataPath" d="M 80 80 L 120 80" fill="none" />

      <g transform="translate(100, 130)">
        <circle r="6" fill="none" stroke="currentColor" strokeWidth="2">
          <animate attributeName="r" values="6;10;6" dur="1s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="1;0.3;1" dur="1s" repeatCount="indefinite" />
        </circle>
      </g>
    </svg>
  );
}

function SecurityVisual() {
  return (
    <svg viewBox="0 0 200 160" className="w-full h-full">
      <path d="M100 20 L140 35 V75 C140 100 122 122 100 135 C78 122 60 100 60 75 V35 L100 20Z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M85 75 L95 85 L115 65" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <animate attributeName="stroke-dasharray" values="0 50;50 0" dur="1.5s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}

function FeatureCard({ feature, index }: { feature: Feature; index: number }) {
  const visuals = {
    deploy: <DeployVisual />,
    ai: <AIVisual />,
    collab: <CollabVisual />,
    security: <SecurityVisual />,
  };

  return (
    <div className="grid lg:grid-cols-[120px_1fr_320px] gap-8 lg:gap-12 py-10 sm:py-12 lg:py-16 border-t border-foreground/10 first:border-t-0">
      <div className="font-display text-3xl lg:text-5xl text-muted-foreground/30">{feature.number}</div>
      <div className="space-y-4">
        <h3 className={sectionFeatureTitleClass}>{feature.title}</h3>
        <p className={`${sectionFeatureBodyClass} max-w-2xl`}>{feature.description}</p>
      </div>
      <div className={`hidden lg:flex items-center justify-center text-primary/80 ${index % 2 === 0 ? "lg:pl-6" : "lg:pr-6"}`}>
        {visuals[feature.visual]}
      </div>
    </div>
  );
}
