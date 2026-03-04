"use client";

import { Badge } from "@/components/ui/badge";
import { BrandCanonSummary } from "./brand-canon-summary";
import type { BrandCanon, PerceptionViewData } from "@/lib/perception-data";
import { PERCEPTION_TEXT } from "@/lib/app-data";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export function PerceptionLeftPanel({
  canon,
  source,
  windowLabel,
  analyzedResponses,
  selectedModels,
  isDemo,
}: {
  canon: BrandCanon;
  source: PerceptionViewData["source"];
  windowLabel: string;
  analyzedResponses: number;
  selectedModels: string[];
  isDemo: boolean;
}) {
  return (
    <div className="flex h-auto flex-col xl:h-full">
      <div className="m-2 mb-4 shrink-0 rounded-md bg-primary p-4 text-primary-foreground">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="mt-1 text-base font-semibold leading-tight">{PERCEPTION_TEXT.leftPanel.title}</h4>
          </div>
          <Badge variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
            {source === "project"
              ? PERCEPTION_TEXT.leftPanel.source.project
              : source === "fallback"
                ? PERCEPTION_TEXT.leftPanel.source.fallback
                : PERCEPTION_TEXT.leftPanel.source.demo}
          </Badge>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {/* <Badge variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
            {canon.brandName}
          </Badge> */}
          {/* <Badge variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
            {windowLabel}
          </Badge>
          <Badge variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
            {analyzedResponses} réponses
          </Badge>
          {selectedModels.slice(0, 2).map((model) => (
            <Badge key={model} variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
              {model}
            </Badge>
          ))}
          {selectedModels.length > 2 ? ( */}
          {/* <Badge variant="secondary" className="border-0 bg-white/15 text-primary-foreground hover:bg-white/15">
              +{selectedModels.length - 2}
            </Badge>
          ) : null} */}
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="mt-0.5 text-xs">
                {PERCEPTION_TEXT.leftPanel.helper}
              </p>
            </div>
            {/* <Button asChild size="sm" variant="secondary" className="h-7 px-2 text-xs">
              <Link href="/perception/brand-canon">Éditer</Link>
            </Button> */}
          </div>
        </div>
      </div>

      <div className="p-2 min-h-0 flex-1 overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-5 pb-4">
          <BrandCanonSummary canon={canon} editHref="/perception/brand-canon" isDemo={isDemo} />
        </div>
      </div>
    </div>
  );
}
