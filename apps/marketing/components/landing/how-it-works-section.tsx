"use client";

import { useTranslations } from 'next-intl';
import { useEffect, useState, useRef } from "react";

export function HowItWorksSection() {
  const t = useTranslations('howItWorks');
  const [activeStep, setActiveStep] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const steps = [
    {
      number: "I",
      title: "Savoir où vous en êtes",
      description: "Visia interroge ChatGPT, Perplexity, Gemini et Claude avec les vraies questions de vos prospects. Vous voyez exactement si vous êtes cité, à quel rang, et ce que les IA disent de vous.",
      code: `// Scan IA Search
const mentions = await visia.scan({
  platforms: ['chatgpt', 'perplexity', 'gemini', 'claude'],
  queries: 'real-prospect-questions',
  company: 'your-company'
})

console.log(mentions.rankings)
console.log(mentions.sentiment)`,
    },
    {
      number: "II",
      title: "Comprendre pourquoi vous êtes mal perçu",
      description: "Les IA vous présentent comme un outil emailing alors que vous êtes un CRM ? Elles citent un pricing erroné ? Visia détecte ces erreurs et vous explique leur origine.",
      code: `// Analyse des erreurs
const analysis = await visia.analyze({
  type: 'perception-issues',
  compare: ['actual-positioning', 'ai-perception'],
  source: mentions
})

console.log(analysis.errors)
console.log(analysis.impact)`,
    },
    {
      number: "III",
      title: "Corriger automatiquement",
      description: "Visia génère les contenus manquants sur votre site — pages comparatives, FAQ, clarifications pricing — et les pousse directement dans Webflow ou votre CMS. Zéro rédaction manuelle.",
      code: `// Génération et déploiement
const correction = await visia.correct({
  generate: ['comparative-pages', 'faq', 'pricing'],
  deploy: {
    platform: 'webflow',
    autoPublish: true
  }
})

console.log(correction.deployed)`,
    },
    {
      number: "IV",
      title: "Mesurer ce que ça vous rapporte",
      description: "Combien de leads viennent de l'IA ? Quel MRR leur est attribuable ? Visia connecte vos mentions IA à GA4, HubSpot et Stripe pour répondre à ces questions.",
      code: `// Tracking ROI
const roi = await Visia.measure({
  connect: ['ga4', 'hubspot', 'stripe'],
  attribution: 'ai-mentions',
  timeframe: '90d'
})

console.log(roi.leads)
console.log(roi.mrr)`,
    },
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
      setActiveStep((prev) => (prev + 1) % steps.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section
      id="how-it-works"
      ref={sectionRef}
      className="relative bg-background text-primary overflow-hidden"
    >
      {/* Diagonal lines pattern */}
      <div className="absolute inset-0 opacity-[0.03] text-primary pointer-events-none">
        <div className="absolute inset-0" style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 40px,
            currentColor 40px,
            currentColor 41px
          )`
        }} />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header */}
        <div className="mb-16 lg:mb-24">

          <h2
            className={`text-4xl lg:text-6xl font-display tracking-tight transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Ce qu'on fait
            <br />
            <span className="text-foreground/50">Tout ce qu'il vous faut pour exister dans l'IA Search.</span>
          </h2>
        </div>

        {/* Main content */}
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Steps */}
          <div className="space-y-0 order-2 lg:order-1">
            {steps.map((step, index) => (
              <button
                key={step.number}
                type="button"
                onClick={() => setActiveStep(index)}
                className={`w-full text-left py-6 lg:py-8 border-b border-foreground/10 transition-all duration-500 group ${
                  activeStep === index ? "opacity-100" : "opacity-40 hover:opacity-70"
                }`}
              >
                <div className="flex items-start gap-4 lg:gap-6">
                  <span className="font-display text-2xl lg:text-3xl text-primary">{step.number}</span>
                  <div className="flex-1">
                    <h3 className="text-lg lg:text-2xl font-display mb-2 lg:mb-3 group-hover:translate-x-2 transition-transform duration-300">
                      {step.title}
                    </h3>
                    <p className="text-sm lg:text-base text-foreground/60 leading-relaxed">
                      {step.description}
                    </p>
                    
                    {/* Progress indicator */}
                    {activeStep === index && (
                      <div className="mt-3 lg:mt-4 h-px bg-foreground/20 overflow-hidden">
                        <div 
                          className="h-full bg-primary w-0"
                          style={{
                            animation: 'progress 5s linear forwards'
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {/* Code display */}
          <div className="order-1 lg:order-2 lg:sticky lg:top-32 self-start mb-8 lg:mb-0">
            <div className="border border-foreground/10 overflow-hidden">
              {/* Window header */}
              <div className="px-4 lg:px-6 py-3 lg:py-4 border-b border-foreground/10 flex items-center justify-between">
                <div className="flex gap-2">
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-foreground/20" />
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-foreground/20" />
                  <div className="w-2 lg:w-3 h-2 lg:h-3 rounded-full bg-foreground/20" />
                </div>
                <span className="text-xs font-mono text-foreground/40">Visia.js</span>
              </div>

            {/*  
              <div className="p-4 lg:p-8 font-mono text-xs lg:text-sm min-h-[200px] lg:min-h-[280px]">
                <pre className="text-foreground/70">
                  {steps[activeStep].code.split('\n').map((line, lineIndex) => (
                    <div 
                      key={`${activeStep}-${lineIndex}`} 
                      className="leading-loose code-line-reveal"
                      style={{ 
                        animationDelay: `${lineIndex * 80}ms`,
                      }}
                    >
                      <span className="text-foreground/20 select-none w-6 lg:w-8 inline-block">{lineIndex + 1}</span>
                      <span className="inline-flex">
                        {line.split('').map((char, charIndex) => (
                          <span
                            key={`${activeStep}-${lineIndex}-${charIndex}`}
                            className="code-char-reveal"
                            style={{
                              animationDelay: `${lineIndex * 80 + charIndex * 15}ms`,
                            }}
                          >
                            {char === ' ' ? '\u00A0' : char}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                </pre>
              </div> */}

              {/* Status */}
              <div className="px-4 lg:px-6 py-3 lg:py-4 border-t border-foreground/10 flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs font-mono text-foreground/40">Running...</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes progress {
          from { width: 0%; }
          to { width: 100%; }
        }
        
        .code-line-reveal {
          opacity: 0;
          transform: translateX(-8px);
          animation: lineReveal 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        @keyframes lineReveal {
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        
        .code-char-reveal {
          opacity: 0;
          filter: blur(8px);
          animation: charReveal 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        
        @keyframes charReveal {
          to {
            opacity: 1;
            filter: blur(0);
          }
        }
      `}</style>
    </section>
  );
}
