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
              "shrink-0 rounded-lg border px-4 py-2 text-sm font-medium transition duration-150",
              active
                ? "border-primary bg-primary/10 text-primary"
                : "border-border/70 bg-background text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-foreground",
              mode.disabled && "cursor-not-allowed opacity-45 hover:border-border/70 hover:bg-background hover:text-muted-foreground",
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
