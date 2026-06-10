import { AlertCircle, Ban, CheckCircle2, CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { useScopedI18n } from "@/shared/hooks/use-i18n";

import type { AuditCheckStatus } from "../../_lib/shared/types";

type StatusBadgeProps = {
  status: AuditCheckStatus;
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useScopedI18n("ai-agent-ready");
  const statusContent = {
    pass: {
      label: t("statusPass"),
      icon: CheckCircle2,
      className: "border-transparent bg-green-500/10 text-green-700",
    },
    fail: {
      label: t("statusFail"),
      icon: AlertCircle,
      className: "border-transparent bg-destructive/10 text-destructive",
    },
    warning: {
      label: t("statusWarning"),
      icon: AlertCircle,
      className: "border-transparent bg-amber-500/10 text-amber-700",
    },
    skipped: {
      label: t("statusSkipped"),
      icon: CircleDashed,
      className: "border-border bg-muted/60 text-muted-foreground",
    },
    not_applicable: {
      label: t("statusNotApplicable"),
      icon: Ban,
      className: "border-border bg-muted/60 text-muted-foreground",
    },
  } satisfies Record<
    AuditCheckStatus,
    { label: string; icon: typeof CheckCircle2; className: string }
  >;
  const content = statusContent[status];
  const Icon = content.icon;

  return (
    <Badge variant="outline" className={content.className}>
      <Icon className="size-3.5" aria-hidden="true" />
      {content.label}
    </Badge>
  );
}
