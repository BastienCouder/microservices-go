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
      title="Prompts et reponses"
      baseline="Catalogue des prompts et flux de reponses avec des filtres communs."
      actionsVariant="classic"
      meta={
        <>
          <Badge variant="default">{activeCount} actifs</Badge>
          {isDemo ? <Badge className="bg-amber-100 text-amber-800">Mode demo</Badge> : null}
        </>
      }
      actions={
        <>
          <Button onClick={onNewPrompt} className="gap-2">
            <Plus className="mr-2 h-4 w-4" />
            Nouveau prompt
          </Button>
          <Button variant="outline" onClick={onAutoGenerate} className="gap-2">
            Generer automatiquement
          </Button>
        </>
      }
    />
  );
}
