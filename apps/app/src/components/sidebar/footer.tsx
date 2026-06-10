"use client";

import { Activity } from "lucide-react";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

export function Footer() {
  const { t } = useScopedI18n("sidebar");

  return (
    <footer className="flex h-8 items-center justify-between border-t bg-muted/20 px-6 text-[10px] text-muted-foreground">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="font-semibold text-foreground">{t("footerPlanPro")}</span>
          <span>({t("footerPromptsUsed", { used: 120, limit: 500 })})</span>
        </div>
        <div className="h-3 w-px bg-border" />
        <div className="flex items-center gap-1.5">
          <Activity className="h-3 w-3 text-green-500" />
          <span>{t("footerLastRunMinutesAgo", { count: 12 })}</span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <a href="#" className="transition-colors hover:text-primary">{t("footerApiDocumentation")}</a>
        <a href="#" className="transition-colors hover:text-primary">{t("footerExportCsv")}</a>
        <span>v1.2.0</span>
      </div>
    </footer>
  );
}
