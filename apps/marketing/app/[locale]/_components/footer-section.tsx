"use client";

import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { ArrowUpRight } from "lucide-react";
import { AnimatedWave } from "./animated-wave";
import { getLocalizedPathname, type Locale } from "@/src/i18n/config";

export function FooterSection() {
  const t = useTranslations("footer");
  const locale = useLocale() as Locale;

  const groups = [
    {
      title: t("groups.product"),
      links: [
        { name: t("links.features"), href: "#features" },
        { name: t("links.howItWorks"), href: "#how-it-works" },
        { name: t("links.developers"), href: "#developers" },
        { name: t("links.pricing"), href: "#pricing" },
      ],
    },
    {
      title: t("groups.company"),
      links: [
        { name: t("links.about"), href: "#" },
        { name: t("links.blog"), href: "#" },
        { name: t("links.careers"), href: "#", badge: t("links.hiring") },
        { name: t("links.contact"), href: "#" },
      ],
    },
    {
      title: t("groups.legal"),
      links: [
        { name: t("links.privacy"), href: "#" },
        { name: t("links.terms"), href: "#" },
        { name: t("links.security"), href: "#security" },
      ],
    },
  ];

  return (
    <footer className="relative border-t border-foreground/10">
      <div className="absolute inset-0 h-64 opacity-20 pointer-events-none overflow-hidden">
        <AnimatedWave />
      </div>

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 lg:px-12">
        <div className="py-14 sm:py-16 lg:py-24">
          <div className="grid grid-cols-2 md:grid-cols-6 gap-12 lg:gap-8">
            <div className="col-span-2">
              <Link href={getLocalizedPathname(locale, "/")} className="inline-flex items-center gap-2 mb-6">
                <span className="text-2xl font-display">Visia</span>
              </Link>

              <p className="text-muted-foreground leading-relaxed mb-8 max-w-xs">{t("description")}</p>

              <div className="flex gap-6">
                {[
                  { name: "Twitter", href: "#" },
                  { name: "GitHub", href: "#" },
                  { name: "LinkedIn", href: "#" },
                ].map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1 group"
                  >
                    {link.name}
                    <ArrowUpRight className="w-3 h-3 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </a>
                ))}
              </div>
            </div>

            {groups.map((group) => (
              <div key={group.title}>
                <h3 className="text-sm font-medium mb-6">{group.title}</h3>
                <ul className="space-y-4">
                  {group.links.map((link) => (
                    <li key={link.name}>
                      <a href={link.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-2">
                        {link.name}
                        {"badge" in link && link.badge ? (
                          <span className="text-xs px-2 py-0.5 bg-foreground text-background rounded-full">{link.badge}</span>
                        ) : null}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="py-6 sm:py-8 border-t border-foreground/10 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">{t("copyright")}</p>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500" />
              {t("status")}
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
