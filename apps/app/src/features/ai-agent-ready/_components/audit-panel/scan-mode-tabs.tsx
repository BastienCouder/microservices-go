import { cn } from "@/shared/utils";

import type { ScanMode } from "../../_lib/shared/types";

type ScanModeTabsProps = {
  modes: Array<{
    id: ScanMode;
    label: string;
    disabled?: boolean;
  }>;
  value: ScanMode;
  onChange: (mode: ScanMode) => void;
};

export function ScanModeTabs({ modes, value, onChange }: ScanModeTabsProps) {
  return (
    <div
      className="flex gap-2 overflow-x-auto pb-1"
      role="tablist"
      aria-label="Scan mode"
    >
      {modes.map((mode) => {
        const active = mode.id === value;
        return (
          <button
            key={mode.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={mode.disabled}
            className={cn(
              "shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition duration-150",
              active
                ? "border-[#f26a21] bg-[#f26a21] text-white shadow-[0_10px_22px_rgba(242,106,33,0.18)]"
                : "border-[#eadfd3] bg-[#fffdf9] text-[#3a2418] hover:border-[#f26a21]/50 hover:bg-[#fff3e8]",
              mode.disabled && "cursor-not-allowed opacity-45 hover:border-[#eadfd3] hover:bg-[#fffdf9]",
            )}
            onClick={() => onChange(mode.id)}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
