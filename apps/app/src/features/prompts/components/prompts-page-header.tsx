"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/features/shared/view/page-header";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";
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
  const content = useI18nScope("prompts-workspace");
  const { t } = useScopedI18n("prompts-workspace");

  return (
    <PageHeader
      title={content.promptsAndResponsesTitle}
      baseline={content.promptsAndResponsesBaseline}
      actionsVariant="classic"
      meta={
        <>
          <Badge variant="default">{t("activeCount", { count: activeCount })}</Badge>
          {isDemo ? <Badge className="bg-amber-100 text-amber-800">{content.demoMode}</Badge> : null}
        </>
      }
      actions={
        <>
          <Button onClick={onNewPrompt} className="gap-2">
            <Plus className="mr-2 h-4 w-4" />
            {content.newPrompt}
          </Button>
          <Button variant="outline" onClick={onAutoGenerate} className="gap-2">
            {content.autoGenerate}
          </Button>
        </>
      }
    />
  );
}
