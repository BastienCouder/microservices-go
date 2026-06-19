"use client";

import type { ReactNode } from "react";
import { EmptyStateCard } from "@/components/shared/empty-state-card";
import { Badge } from "@/components/ui/badge";
import type { BrandCanon } from "../_lib/shared/perception-data";
import { cn } from "@/lib/utils";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

const STEP_CLASS =
  "group grid grid-cols-[28px_1fr] gap-3 rounded-lg";
const STEP_DOT_CLASS =
  "transition-transform duration-200 ease-out group-hover:scale-125";

export function BrandCanonSummary({
  canon,
  isDemo,
  action,
}: {
  canon: BrandCanon;
  isDemo: boolean;
  action?: ReactNode;
}) {
  const { t } = useScopedI18n("perception-brand-canon");
  return (
    <div className="space-y-3">
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-3 left-[6px] w-px bg-gradient-to-b from-primary/60 via-primary/30 to-transparent" />

        <div className="space-y-3">
          <div className={STEP_CLASS}>
            <div className="relative pt-0.5">
              <div className={cn("h-3 w-3 rounded-full border-2 border-primary bg-background shadow-sm", STEP_DOT_CLASS)} />
            </div>
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div>
                  <div className="text-[11px] text-muted-foreground">{t("summaryBrand")}</div>
                  <div className="text-base font-semibold leading-tight">{canon.brandName}</div>
                </div>
                <div className="h-6 w-px bg-border/70" />
                <div>
                  <div className="text-[11px] text-muted-foreground">{t("summaryCategory")}</div>
                  <div className="text-base font-semibold leading-tight">{canon.category}</div>
                </div>
              </div>
            </div>
          </div>

          <div className={STEP_CLASS}>
            <div className="relative pt-1">
              <div className={cn("h-3 w-3 rounded-full bg-[hsl(186_49%_62%)] shadow-sm", STEP_DOT_CLASS)} />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">{t("summaryAudience")}</div>
              <div className="flex flex-wrap gap-1.5">
                {canon.audience.length > 0 ? (
                  canon.audience.map((item) => (
                    <Badge key={item} variant="secondary" className="text-sm font-normal">
                      {item}
                    </Badge>
                  ))
                ) : (
                  <EmptyStateCard label={t("summaryEmpty")} className="h-10 w-full justify-start text-left text-sm" />
                )}
              </div>
            </div>
          </div>

          <div className={STEP_CLASS}>
            <div className="relative pt-1">
              <div className={cn("h-3 w-3 rounded-full bg-[hsl(204_40%_47%)] shadow-sm", STEP_DOT_CLASS)} />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">{t("summaryUseCases")}</div>
              <div className="flex flex-wrap gap-1.5">
                {canon.useCases.length > 0 ? (
                  canon.useCases.map((item, index) => (
                    <div key={item} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-1 text-sm">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-muted text-[10px] font-medium">{index + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))
                ) : (
                  <EmptyStateCard label={t("summaryEmpty")} className="h-10 w-full justify-start text-left text-sm" />
                )}
              </div>
            </div>
          </div>
          <div className={STEP_CLASS}>
            <div className="relative pt-1">
              <div className={cn("h-3 w-3 rounded-full bg-[hsl(193_34%_56%)] shadow-sm", STEP_DOT_CLASS)} />
            </div>
            <div className="space-y-1">
              <div className="text-[11px] font-medium text-muted-foreground">{t("summaryFeatures")}</div>
              {canon.features.length > 0 ? (
                <div className="grid grid-cols-1">
                  {canon.features.map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-lg bg-background/70 px-2.5 py-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-sm leading-snug">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyStateCard label={t("summaryEmpty")} className="h-10 justify-start text-left text-sm" />
              )}
            </div>
          </div>
        </div>
      </div>
      {action ? <div className="w-full pt-1">{action}</div> : null}
    </div>
  );
}
