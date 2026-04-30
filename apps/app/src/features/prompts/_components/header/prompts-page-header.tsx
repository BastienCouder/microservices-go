"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";
import { Plus } from "lucide-react";

type PromptsPageHeaderProps = {
  activeCount: number;
  activeCountLoading?: boolean;
  isDemo: boolean;
  onNewPrompt: () => void;
  onAutoGenerate: () => void;
  onImportCsv: () => void;
};

export function PromptsPageHeader({
  activeCount,
  activeCountLoading = false,
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
          {activeCountLoading ? (
            <Skeleton className="h-6 w-24 rounded-full" />
          ) : (
            <Badge variant="default">{t("activeCount", { count: activeCount })}</Badge>
          )}
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
