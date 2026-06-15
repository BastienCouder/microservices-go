"use client";

import { cn } from "@/lib/utils";
import type { PromptLanguage } from "../../_lib/types";

const FLAG_CLASS_BY_LANGUAGE: Record<PromptLanguage, string> = {
  fr: "fi fi-fr",
  en: "fi fi-gb",
};

type PromptLanguageIndicatorProps = {
  language: PromptLanguage;
  label?: string;
  className?: string;
  flagClassName?: string;
};

export function PromptLanguageIndicator({
  language,
  label,
  className,
  flagClassName,
}: PromptLanguageIndicatorProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden="true"
        className={cn(FLAG_CLASS_BY_LANGUAGE[language], "rounded-[2px] text-base leading-none", flagClassName)}
      />
      {label ? <span>{label}</span> : null}
    </span>
  );
}
