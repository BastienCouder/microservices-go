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
        "flex gap-3 rounded-[14px] border border-[#eadfd3] bg-[#fffdf9] p-3 transition duration-150",
        "hover:border-[#f26a21]/40 hover:bg-[#fff8f0]",
        check.disabled && "cursor-not-allowed opacity-55 hover:border-[#eadfd3] hover:bg-[#fffdf9]",
      )}
    >
      <Checkbox
        checked={checked}
        disabled={check.disabled}
        className="mt-1 border-[#d8d1ca] data-checked:border-[#f26a21] data-checked:bg-[#f26a21]"
        aria-label={check.label}
        onCheckedChange={() => {
          if (isRealCheck && !check.disabled) {
            onToggle(check.id as AuditCheckID);
          }
        }}
      />
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#3a2418]">{check.label}</span>
        <span className="mt-1 block text-sm leading-5 text-[#866d5d]">
          {check.description}
        </span>
      </span>
    </label>
  );
}
