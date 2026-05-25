import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/shared/utils";

import type { AuditCheckID, CheckOption } from "../../_lib/shared/types";

type CheckToggleProps = {
  check: CheckOption;
  checked: boolean;
  onToggle: (checkID: AuditCheckID) => void;
};

export function CheckToggle({ check, checked, onToggle }: CheckToggleProps) {
  const isRealCheck = check.id !== "web_bot_auth";

  return (
    <label
      className={cn(
        "flex gap-3 rounded-xl border p-3 transition duration-150",
        checked
          ? "border-primary/30 bg-primary/5"
          : "border-border/70 bg-background hover:border-primary/30 hover:bg-primary/5",
        check.disabled && "cursor-not-allowed opacity-55 hover:border-border/70 hover:bg-background",
      )}
    >
      <Checkbox
        checked={checked}
        disabled={check.disabled}
        className="mt-1"
        aria-label={check.label}
        onCheckedChange={() => {
          if (isRealCheck && !check.disabled) {
            onToggle(check.id as AuditCheckID);
          }
        }}
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-foreground">{check.label}</span>
        <span className="mt-1 block text-sm leading-5 text-muted-foreground">
          {check.description}
        </span>
      </span>
    </label>
  );
}
