"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18nScope, useScopedI18n } from "@/shared/hooks/use-i18n";
import { Loader2, Plus, Sparkles } from "lucide-react";

type PromptsPageHeaderProps = {
  activeCount: number;
  activeCountLoading?: boolean;
  isDemo: boolean;
  generatingPrompts?: boolean;
  onNewPrompt: () => void;
  onAutoGenerate: () => void;
  onImportCsv: () => void;
};

export function PromptsPageHeader({
  activeCount,
  activeCountLoading = false,
  isDemo,
  generatingPrompts = false,
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
      className="mb-3 md:mb-4"
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
      actionsClassName="grid grid-cols-2 gap-2 translate-y-3 sm:flex md:translate-y-5"
      actions={
        <>
          <Button
            aria-label={content.newPrompt}
            onClick={onNewPrompt}
            className="h-10 min-w-0 px-3 sm:h-auto sm:min-w-fit sm:px-4.5"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{content.newPrompt}</span>
          </Button>
          <Button
            aria-label={content.autoGenerate}
            variant="outline"
            onClick={onAutoGenerate}
            disabled={generatingPrompts}
            className="h-10 min-w-0 px-3 sm:h-auto sm:min-w-fit sm:px-4.5"
          >
            {generatingPrompts ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
             null
            )}
            <span className="truncate">
              {generatingPrompts ? content.launching : content.autoGenerate}
            </span>
          </Button>
        </>
      }
    />
  );
}
