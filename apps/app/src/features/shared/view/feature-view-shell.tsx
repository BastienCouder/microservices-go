import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { PageHeader } from "../../../components/shared/page-header";

type FeatureViewShellProps = {
  title: string;
  description: string;
  status: string;
  actions?: ReactNode;
};

export function FeatureViewShell({ title, description, status, actions }: FeatureViewShellProps) {
  const { t } = useScopedI18n("shared-view");
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title={title}
        baseline={description}
        meta={<Badge variant="outline">{t("inPreparation")}</Badge>}
        actions={actions}
      />

      <div className="mt-4 flex min-h-0 flex-1 flex-col rounded-md rounded-tr-none bg-background">
        <div className="border-b px-4 py-5 md:px-6">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-foreground">{t("pageState")}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{status}</p>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 items-start px-4 py-5 md:px-6">
          <div className="w-full rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-8 text-sm leading-6 text-muted-foreground">
            {t("sharedHeaderNotice")}
          </div>
        </div>
      </div>
    </div>
  );
}
