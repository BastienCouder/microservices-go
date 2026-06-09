"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultLocale,
  getLocalizedPathname,
  locales,
  stripLocalePrefix,
  type Locale,
} from "@/src/i18n/config";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const t = useTranslations("localeSwitcher");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const normalizedPathname = stripLocalePrefix(pathname);
  const search = searchParams.toString();
  const localeLabels: Record<Locale, string> = {
    fr: t("locales.fr"),
    en: t("locales.en"),
  };

  return (
    <div
      aria-label={t("label")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-foreground/10 bg-background/80 p-1 backdrop-blur-xl",
        className,
      )}
      role="group"
    >
      <span className="sr-only">{t("label")}</span>
      <Languages className="ml-2 size-4 text-foreground/50" />
      {locales.map((nextLocale) => {
        const href = `${getLocalizedPathname(nextLocale, normalizedPathname)}${search ? `?${search}` : ""}`;
        const isActive = nextLocale === locale || (!locale && nextLocale === defaultLocale);

        return (
          <Button
            key={nextLocale}
            asChild
            className={cn(
              "h-9 rounded-full px-3 text-xs font-semibold transition-colors",
              isActive
                ? "bg-primary text-background hover:bg-primary/90 hover:text-background"
                : "bg-transparent text-foreground/65 hover:text-foreground",
            )}
            size="sm"
            variant="ghost"
          >
            <Link
              href={href}
              hrefLang={nextLocale}
              locale={false}
              onClick={() => {
                document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
              }}
            >
              {localeLabels[nextLocale]}
              {isActive ? <Check className="ml-1 size-3.5" /> : null}
            </Link>
          </Button>
        );
      })}
    </div>
  );
}
