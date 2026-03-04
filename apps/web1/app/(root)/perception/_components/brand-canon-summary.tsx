"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PERCEPTION_TEXT } from "@/lib/app-data";
import type { BrandCanon } from "@/lib/perception-data";

export function BrandCanonSummary({
  canon,
  editHref,
  isDemo,
}: {
  canon: BrandCanon;
  editHref: string;
  isDemo: boolean;
}) {
  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-y-3 left-[6px] w-px bg-gradient-to-b from-primary/50 via-primary/20 to-transparent" />

        <div className="space-y-4">
          <div className="grid grid-cols-[28px_1fr] gap-3">
            <div className="relative pt-0.5">
              <div className="h-3 w-3 rounded-full border-2 border-primary bg-background shadow-sm" />
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{PERCEPTION_TEXT.brandCanon.labels.brand}</div>
                  <div className="text-sm font-semibold">{canon.brandName}</div>
                </div>
                <div className="h-6 w-px bg-border/70" />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{PERCEPTION_TEXT.brandCanon.labels.category}</div>
                  <div className="text-sm font-semibold">{canon.category}</div>
                </div>
              </div>
              <div className="mt-3 rounded-md border border-border/60 bg-background/80 px-2.5 py-2">
                <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground">{PERCEPTION_TEXT.brandCanon.labels.positioning}</div>
                <p className="mt-1 text-sm leading-relaxed text-foreground">{canon.positioning}</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[28px_1fr] gap-3">
            <div className="relative pt-1">
              <div className="h-3 w-3 rounded-full bg-[hsl(186_49%_62%)] shadow-sm" />
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{PERCEPTION_TEXT.brandCanon.labels.audience}</div>
              <div className="flex flex-wrap gap-1.5">
                {canon.audience.length > 0 ? (
                  canon.audience.map((item) => (
                    <Badge key={item} variant="secondary" className="font-normal">
                      {item}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">{PERCEPTION_TEXT.brandCanon.empty}</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-[28px_1fr] gap-3">
            <div className="relative pt-1">
              <div className="h-3 w-3 rounded-full bg-[hsl(204_40%_47%)] shadow-sm" />
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{PERCEPTION_TEXT.brandCanon.labels.useCases}</div>
              <div className="flex flex-wrap gap-1.5">
                {canon.useCases.length > 0 ? (
                  canon.useCases.map((item, index) => (
                    <div key={item} className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background px-2 py-1 text-xs">
                      <span className="grid h-4 w-4 place-items-center rounded-full bg-muted text-[10px] font-medium">{index + 1}</span>
                      <span>{item}</span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">{PERCEPTION_TEXT.brandCanon.empty}</span>
                )}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-[28px_1fr] gap-3">
            <div className="relative pt-1">
              <div className="h-3 w-3 rounded-full bg-[hsl(193_34%_56%)] shadow-sm" />
            </div>
            <div className="space-y-2">
              <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">{PERCEPTION_TEXT.brandCanon.labels.features}</div>
              {canon.features.length > 0 ? (
                <div className="grid grid-cols-1">
                  {canon.features.map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-md bg-background/70 px-2.5 py-1.5">
                      <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      <span className="text-xs leading-relaxed">{item}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-xs text-muted-foreground">{PERCEPTION_TEXT.brandCanon.empty}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-md bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
        {isDemo
          ? PERCEPTION_TEXT.brandCanon.demoHint
          : PERCEPTION_TEXT.brandCanon.projectHint}
      </div>
    </div>
  );
}
