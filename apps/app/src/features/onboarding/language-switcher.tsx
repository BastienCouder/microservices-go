import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale, useScopedI18n } from "@/shared/hooks/use-i18n";
import i18n from "@/shared/i18n";
import { cn } from "@/shared/utils";

const LANGUAGE_OPTIONS = [
  { value: "fr", shortLabel: "FR" },
  { value: "en", shortLabel: "EN" },
] as const;

export function OnboardingLanguageSwitcher() {
  const { locale } = useLocale();
  const { t } = useScopedI18n("onboarding");

  return (
    <div className="flex items-center gap-1 rounded-full border border-white/70 bg-white/90 p-1.5 backdrop-blur">
      <span className="flex items-center gap-1 px-2 text-xs font-medium text-muted-foreground">
        <Languages className="size-3.5" />
        {t("language")}
      </span>

      {LANGUAGE_OPTIONS.map((option) => {
        const active = locale === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            variant={active ? "default" : "ghost"}
            size="sm"
            className={cn("rounded-full px-3", !active && "text-muted-foreground")}
            onClick={() => void i18n.changeLanguage(option.value)}
          >
            {option.shortLabel}
          </Button>
        );
      })}
    </div>
  );
}
