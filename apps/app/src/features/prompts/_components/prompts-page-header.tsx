"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/shared/view/page-header";
import { Plus } from "lucide-react";

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
    <PageHeader
      title="Prompts & Responses"
      baseline="Prompt catalog and live response stream with shared global filters."
      actionsVariant="classic"
      meta={
        <>
          <Badge variant="default">{activeCount} active</Badge>
          {isDemo ? <Badge className="bg-amber-100 text-amber-800">Demo</Badge> : null}
        </>
      }
      actions={
        <>
          <Button onClick={onNewPrompt} className="gap-2">
            <Plus className="mr-2 h-4 w-4" />
            New prompt
          </Button>
          <Button variant="outline" onClick={onAutoGenerate} className="gap-2">
            Auto-generate
          </Button>
          <Button variant="outline" onClick={onImportCsv} className="gap-2">
            Import CSV
          </Button>
        </>
      }
    />
  );
}
