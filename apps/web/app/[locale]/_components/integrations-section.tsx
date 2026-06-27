"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import {
  getSectionRevealClass,
  sectionHeadingClass,
  sectionHeadingMutedClass,
  sectionIntroTextClass,
} from "./section-styles";

export function IntegrationsSection() {
  const t = useTranslations("integrations");
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const integrations = [
    {
      name: "GA4",
      category: t("items.ga4.category"),
      color: "group-hover:text-[#E27625]",
      icon: <img src="/icon/ga4.svg" alt="GA4" className="w-6 h-6" />,
    },
    // {
    //   name: "HubSpot",
    //   category: t("items.hubspot.category"),
    //   color: "group-hover:text-[#FF7A59]",
    //   icon: <img src="/icon/hubspot.svg" alt="HubSpot" className="w-6 h-6" />,
    // },
    // {
    //   name: "Stripe",
    //   category: t("items.stripe.category"),
    //   color: "group-hover:text-[#635BFF]",
    //   icon: <img src="/icon/stripe.svg" alt="Stripe" className="w-6 h-6" />,
    // },
    // {
    //   name: "Webflow",
    //   category: t("items.webflow.category"),
    //   color: "group-hover:text-[#4353FF]",
    //   icon: <img src="/icon/webflow.svg" alt="Webflow" className="w-6 h-6" />,
    // },
    {
      name: "Markdown",
      category: t("items.markdown.category"),
      color: "group-hover:text-foreground",
      icon: <img src="/icon/markdown.svg" alt="Markdown" className="w-6 h-6" />,
    },
  ];
  const repeatedIntegrations = Array.from({ length: 12 }, () => integrations).flat();

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
    <section ref={sectionRef} className="relative py-16 sm:py-20 lg:py-28 overflow-hidden bg-background">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div
          className={`text-center max-w-3xl mx-auto mb-20 lg:mb-24 ${getSectionRevealClass(isVisible)}`}
        >
          <h2 className={`${sectionHeadingClass} mb-8`}>
            {t("title")}
            <br />
            <span className={`${sectionHeadingMutedClass} font-light`}>{t("subtitle")}</span>
          </h2>
          <p className={`${sectionIntroTextClass} mx-auto`}>{t("description")}</p>
        </div>
      </div>

      <div className="relative mt-8">
        <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-background to-transparent z-10" />

        <div className="flex overflow-hidden group">
          <motion.div
            animate={{ x: ["0%", "-50%"] }}
            className="flex gap-8 pr-8"
            transition={{ duration: 16, ease: "linear", repeat: Infinity }}
            whileHover={{ animationPlayState: "paused" }}
          >
            {repeatedIntegrations.map((item, index) => (
              <div
                key={`${item.name}-${index}`}
                className="shrink-0 flex items-center gap-5 px-8 py-5 border border-primary/10 bg-background/[0.01] rounded-lg backdrop-blur-sm transition-all duration-500 group/card hover:border-primary/20 hover:bg-primary/[0.03]"
              >
                <div className={`transition-all duration-300 text-muted-foreground/40 ${item.color}`}>{item.icon}</div>
                <div>
                  <div className="text-lg font-medium leading-none mb-1.5">{item.name}</div>
                  <div className="text-[10px] font-mono text-muted-foreground uppercase">{item.category}</div>
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
