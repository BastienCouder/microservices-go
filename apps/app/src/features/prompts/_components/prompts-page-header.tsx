"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DashboardSectionTitle } from "@/features/dashboard/_components/dashboard-section-title";
import { FileUp, Plus, Sparkles } from "lucide-react";

type PromptsPageHeaderProps = {
  activeCount: number;
  isDemo: boolean;
  onNewPrompt: () => void;
  onAutoGenerate: () => void;
  onImportCsv: () => void;
};

export function PromptsPageHeader({
  activeCount,
  isDemo,
  onNewPrompt,
  onAutoGenerate,
  onImportCsv,
}: PromptsPageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3"
 >
          <h1>
            <DashboardSectionTitle className="text-base md:text-lg">
              Prompts &amp; Responses
            </DashboardSectionTitle>
          </h1>
          <Badge variant="outline" className="mt-3">{activeCount} active</Badge>
          {isDemo && <Badge className="bg-amber-100 text-amber-800">Demo</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Prompt catalog and live response stream with shared global filters.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 mt-3">
        <Button onClick={onNewPrompt} className="gap-2">
          <Plus className="h-4 w-4" />
          New prompt
        </Button>
        <Button variant="outline" onClick={onAutoGenerate} className="gap-2">
          Auto-generate
        </Button>
        <Button variant="outline" onClick={onImportCsv} className="gap-2">
          Import CSV
        </Button>
      </div>
    </div>
  );
}
