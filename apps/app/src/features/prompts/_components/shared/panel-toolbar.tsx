import type { ReactNode } from "react";

type PanelToolbarProps = {
  summary: ReactNode;
  children: ReactNode;
};

export function PanelToolbar({ summary, children }: PanelToolbarProps) {
  return (
    <div className="border-b py-2 md:px-4 md:py-3">
      <div className="flex min-h-10 justify-between gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex shrink-0 items-center">{summary}</div>
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center lg:justify-end">
          {children}
        </div>
      </div>
    </div>
  );
}
