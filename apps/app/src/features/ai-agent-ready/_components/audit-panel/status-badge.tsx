import { AlertCircle, Ban, CheckCircle2, CircleDashed } from "lucide-react";

import { Badge } from "@/components/ui/badge";

import type { AuditCheckStatus } from "../../_lib/shared/types";

type StatusBadgeProps = {
  status: AuditCheckStatus;
};

const statusContent = {
  pass: {
    label: "OK",
    icon: CheckCircle2,
    className: "border-transparent bg-green-500/10 text-green-700",
  },
  fail: {
    label: "Échec",
    icon: AlertCircle,
    className: "border-transparent bg-destructive/10 text-destructive",
  },
  warning: {
    label: "Alerte",
    icon: AlertCircle,
    className: "border-transparent bg-amber-500/10 text-amber-700",
  },
  skipped: {
    label: "Ignoré",
    icon: CircleDashed,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
  not_applicable: {
    label: "N/A",
    icon: Ban,
    className: "border-border bg-muted/60 text-muted-foreground",
  },
} satisfies Record<
  AuditCheckStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
>;

export function StatusBadge({ status }: StatusBadgeProps) {
  const content = statusContent[status];
  const Icon = content.icon;

  return (
    <Badge variant="outline" className={content.className}>
      <Icon className="size-3.5" aria-hidden="true" />
      {content.label}
    </Badge>
  );
}
