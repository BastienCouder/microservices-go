"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Shield, Lock, Eye, FileCheck } from "lucide-react";
import { getSectionRevealClass } from "./section-styles";

export function SecuritySection() {
  const { t } = useTranslation();
  const [isVisible, setIsVisible] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);

  const securityFeatures = [
    {
      icon: Shield,
      title: t("security.soc2"),
      description: t("security.soc2Desc"),
    },
    {
      icon: Lock,
      title: t("security.encryption"),
      description: t("security.encryptionDesc"),
    },
    {
      icon: Eye,
      title: t("security.zeroTrust"),
      description: t("security.zeroTrustDesc"),
    },
    {
      icon: FileCheck,
      title: t("security.compliance"),
      description: t("security.complianceDesc"),
    },
  ];

  const certifications = ["SOC 2", "ISO 27001", "HIPAA", "GDPR", "CCPA"];

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

  return (
    <section id="security" ref={sectionRef} className="relative py-24 lg:py-32 bg-foreground/[0.02] overflow-hidden">
      <div className="max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24">
          {/* Left: Content */}
          <div
            className={getSectionRevealClass(isVisible)}
          >
            <span className="inline-flex items-center gap-3 text-sm font-mono text-muted-foreground mb-6">
              <span className="w-8 h-px bg-foreground/30" />
              {t("security.eyebrow")}
            </span>
            <h2 className="text-4xl lg:text-6xl font-display tracking-tight mb-8">
              {t("security.title")}
              <br />
              {t("security.title2")}
            </h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-12">
              {t("security.description")}
            </p>

            {/* Certifications */}
            <div className="flex flex-wrap gap-3">
              {certifications.map((cert, index) => (
                <span
                  key={cert}
                  className={`px-4 py-2 border border-foreground/10 text-sm font-mono ${getSectionRevealClass(isVisible, "up", "sm")}`}
                  style={{ transitionDelay: `${index * 50 + 200}ms` }}
                >
                  {cert}
                </span>
              ))}
            </div>
          </div>

          {/* Right: Features */}
          <div className="grid gap-6">
            {securityFeatures.map((feature, index) => (
              <div
                key={feature.title}
                className={`p-6 border border-foreground/10 hover:border-foreground/20 group ${getSectionRevealClass(isVisible, "right")}`}
                style={{ transitionDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0 w-10 h-10 flex items-center justify-center border border-foreground/10 group-hover:bg-foreground group-hover:text-background transition-colors duration-300">
                    <feature.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium mb-1 group-hover:translate-x-1 transition-transform duration-300">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground">{feature.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
