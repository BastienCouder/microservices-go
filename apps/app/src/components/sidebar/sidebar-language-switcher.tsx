"use client";

import { Check, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useLocale, useI18nScope } from "@/shared/hooks/use-i18n";
import i18n from "@/shared/i18n";
import { cn } from "@/shared/utils";

type SidebarLanguageSwitcherProps = {
  collapsed: boolean;
};

export function SidebarLanguageSwitcher({ collapsed }: SidebarLanguageSwitcherProps) {
  const { locale } = useLocale();
  const content = useI18nScope("sidebar");

  const options = [
    { value: "fr", label: content.french },
    { value: "en", label: content.english },
  ] as const;

  const trigger = (
    <Button
      type="button"
      variant="ghost"
      className={cn(
        "w-full rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground",
        collapsed ? "justify-center" : "justify-between",
      )}
    >
      <span className={cn("flex items-center gap-2", collapsed && "justify-center")}>
        <Languages className="h-4 w-4" />
        {!collapsed ? <span>{content.language}</span> : null}
      </span>
      {!collapsed ? <span className="text-xs uppercase">{locale}</span> : null}
    </Button>
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        {trigger}
      </PopoverTrigger>
      <PopoverContent side="right" align="end" className="w-40 p-1.5">
        <div className="space-y-0.5">
          {options.map((option) => {
            const active = locale === option.value;

            return (
              <button
                key={option.value}
                type="button"
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2.5 py-2 text-sm transition-colors",
                  active ? "bg-primary/8 text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
                onClick={() => void i18n.changeLanguage(option.value)}
              >
                <span>{option.label}</span>
                {active ? <Check className="h-4 w-4 text-primary" /> : null}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
