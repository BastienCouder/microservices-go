"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";

const integrations = [
  { 
    name: "GA4", 
    category: "Analytics", 
    color: "group-hover:text-[#E27625]",
    icon: (
      <img src="/icon/ga4.svg" alt="GA4" className="w-6 h-6" />
    )
  },
  { 
    name: "HubSpot", 
    category: "CRM & Growth", 
    color: "group-hover:text-[#FF7A59]",
    icon: <img src="/icon/hubspot.svg" alt="HubSpot" className="w-6 h-6" />
  },
  { 
    name: "Stripe", 
    category: "Revenue", 
    color: "group-hover:text-[#635BFF]",
    icon: <img src="/icon/stripe.svg" alt="Stripe" className="w-6 h-6" />
  },
  { 
    name: "Webflow", 
    category: "CMS & Web", 
    color: "group-hover:text-[#4353FF]",
    icon: <img src="/icon/webflow.svg" alt="Webflow" className="w-6 h-6" />
  },
  { 
    name: "Markdown", 
    category: "AI Ready", 
    color: "group-hover:text-foreground",
    icon: <img src="/icon/markdown.svg" alt="Markdown" className="w-6 h-6" />
  },
];

export function IntegrationsSection() {
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setIsVisible(true); },
      { threshold: 0.1 }
    );
    if (sectionRef.current) observer.observe(sectionRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <section 
      ref={sectionRef} 
      className="relative py-12 overflow-hidden bg-background"
    >
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        {/* Header avec espacement corrigé */}
        <div className={`text-center max-w-3xl mx-auto mb-20 lg:mb-24 transition-all duration-1000 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
        }`}>
          <h2 className="text-primary text-4xl lg:text-6xl font-display tracking-tight mb-8">
            Intégrez Visia partout.
            <br />
            <span className="text-muted-foreground font-light">Votre workflow, sans friction.</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Connectez vos scores de visibilité IA à vos outils analytics, CRM et reporting en quelques clics.
          </p>
        </div>
      </div>
      
      {/* Container du Marquee */}
      <div className="relative mt-8">
        {/* Gradients de fondu sur les côtés */}
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />

        <div className="flex overflow-hidden group">
          <motion.div 
            className="flex gap-8 pr-8"
            animate={{ x: ["0%", "-50%"] }}
            transition={{ 
              duration: 30, 
              ease: "linear", 
              repeat: Infinity 
            }}
            // Pause au survol
            whileHover={{ animationPlayState: "paused" }}
          >
            {/* On double la liste pour le loop infini */}
            {[...integrations, ...integrations, ...integrations, ...integrations].map((item, idx) => (
              <div
                key={`${item.name}-${idx}`}
                className="shrink-0 flex items-center gap-5 px-8 py-5 border border-primary/10 bg-background/[0.01] rounded-lg backdrop-blur-sm transition-all duration-500 group/card hover:border-primary/20 hover:bg-primary/[0.03]"
              >
                <div className={`transition-all duration-300 text-muted-foreground/40 ${item.color}`}>
                  {item.icon}
                </div>
                <div>
                  <div className="text-lg font-medium leading-none mb-1.5">{item.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">
                    {item.category}
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}