import { AlertCircle, Ban, CheckCircle2, CircleDashed } from "lucide-react";

import { cn } from "@/shared/utils";

import type { AuditCheckStatus } from "../../_lib/shared/types";

type StatusBadgeProps = {
  status: AuditCheckStatus;
};

const statusContent = {
  pass: {
    label: "Pass",
    icon: CheckCircle2,
    className: "bg-[#1fa35b]/10 text-[#126c3b] ring-[#1fa35b]/20",
  },
  fail: {
    label: "Fail",
    icon: AlertCircle,
    className: "bg-[#df4c4c]/10 text-[#a83333] ring-[#df4c4c]/20",
  },
  warning: {
    label: "Warning",
    icon: AlertCircle,
    className: "bg-[#f3a43b]/14 text-[#8a5616] ring-[#f3a43b]/25",
  },
  skipped: {
    label: "Skipped",
    icon: CircleDashed,
    className: "bg-[#d8d1ca]/35 text-[#6e6259] ring-[#d8d1ca]",
  },
  not_applicable: {
    label: "N/A",
    icon: Ban,
    className: "bg-[#d8d1ca]/35 text-[#6e6259] ring-[#d8d1ca]",
  },
} satisfies Record<
  AuditCheckStatus,
  { label: string; icon: typeof CheckCircle2; className: string }
>;

export function StatusBadge({ status }: StatusBadgeProps) {
  const content = statusContent[status];
  const Icon = content.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1",
        content.className,
      )}
    >
      <Icon className="size-3.5" aria-hidden="true" />
      {content.label}
    </span>
  );
}
