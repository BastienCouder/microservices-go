"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Prompts &amp; Responses</h1>
          <Badge variant="outline">{activeCount} active</Badge>
          {isDemo && <Badge className="bg-amber-100 text-amber-800">Demo</Badge>}
        </div>
        <p className="text-sm text-muted-foreground">
          Prompt catalog and live response stream with shared global filters.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button onClick={onNewPrompt} className="gap-2">
          <Plus className="h-4 w-4" />
          New prompt
        </Button>
        <Button variant="outline" onClick={onAutoGenerate} className="gap-2">
          <Sparkles className="h-4 w-4" />
          Auto-generate
        </Button>
        <Button variant="outline" onClick={onImportCsv} className="gap-2">
          <FileUp className="h-4 w-4" />
          Import CSV
        </Button>
      </div>
    </div>
  );
}
