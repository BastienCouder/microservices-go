"use client";

import { useTranslations } from 'next-intl';
import { useEffect, useState, useRef } from "react";

// Types pour les LLMs
interface LLM {
  name: string;
  status: string;
  icon: string | React.ReactNode;
}

export function InfrastructureSection() {
  const t = useTranslations('infrastructure');
  const [isVisible, setIsVisible] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);

  const llms: LLM[] = [
    { name: "ChatGPT", status: "", icon: "/models/openai.svg" },
    { name: "Perplexity", status: "", icon: "/models/perplexity.svg" },
    { name: "Claude", status: "", icon: "/models/anthropic.svg" },
    { name: "Gemini", status: "", icon: "/models/google.svg" },
    { name: "Grok", status: "", icon:  "/models/grok.svg" },
    { name: "Copilot", status: "", icon: "/models/copilot.svg" },
    { name: "DeepSeek", status: "", icon: "/models/deepseek.svg" },
    { name: "Mistral", status: "", icon: "/models/mistral.svg" },
    { name: "Meta AI", status: "", icon: "/models/meta.svg" },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setIsVisible(true);
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % llms.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [llms.length]);

  return (
    <section ref={sectionRef} className="relative py-24 lg:py-32 overflow-hidden bg-background">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          
          {/* Left: Content */}
          <div
            className={`transition-all duration-700 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-8"
            }`}
          >
            <h2 className="text-primary text-4xl lg:text-6xl font-display tracking-tight mb-8">
              Tous les endroits où
              <br />
              vos prospects posent leurs questions.
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12 max-w-xl">
              Visia monitore votre visibilité sur les 9 principaux LLMs, dans toutes les langues 
              et tous les marchés où vous opérez. Une seule plateforme pour tout voir.
            </p>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-8 border-t border-foreground/10 pt-12">
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">9</div>
                <div className="text-sm text-primary uppercase font-mono">LLMs couverts</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">99,9%</div>
                <div className="text-sm text-primary uppercase font-mono">Disponibilité</div>
              </div>
              <div>
                <div className="text-4xl lg:text-5xl font-display mb-2">&lt;50ms</div>
                <div className="text-sm text-primary uppercase font-mono">Temps de réponse</div>
              </div>
            </div>
          </div>

          {/* Right: LLM List */}
          <div
            className={`transition-all duration-700 delay-200 ${
              isVisible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-8"
            }`}
          >
            <div className="rounded-lg border border-foreground/10 bg-primary/[0.05] backdrop-blur-sm">
              {/* Header */}
              <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-primary uppercase tracking-widest">Tous les LLMs</span>
                <span className="flex items-center gap-2 text-xs font-mono text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  LIVE MONITORING
                </span>
              </div>

              {/* LLM Grid/List */}
              <div className="grid grid-cols-1">
                {llms.map((llm, index) => (
                  <div
                    key={llm.name}
                    className={`px-6 py-4 border-b border-foreground/5 last:border-b-0 flex items-center justify-between transition-all duration-500 ${
                      activeIndex === index ? "bg-primary/[0.04]" : "bg-background"
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      {/* SVG Icon Container */}
                      <div className={`w-8 h-8 flex items-center justify-center transition-colors duration-300 ${
                          activeIndex === index ? "text-foreground" : "text-muted-foreground/40"
                        }`}>
                        {typeof llm.icon === 'string' ? (
                          <img src={llm.icon} alt={llm.name} className="w-5 h-5" />
                        ) : (
                          <svg 
                            viewBox="0 0 24 24" 
                            fill="none" 
                            stroke="currentColor" 
                            strokeWidth="1.5" 
                            strokeLinecap="round" 
                            strokeLinejoin="round" 
                            className="w-5 h-5"
                          >
                            {llm.icon}
                          </svg>
                        )}
                      </div>
                      
                      <div>
                        <div className={`font-medium transition-colors duration-300 ${
                          activeIndex === index ? "text-foreground" : "text-muted-foreground"
                        }`}>
                          {llm.name}
                        </div>
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