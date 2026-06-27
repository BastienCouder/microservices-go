import type { ReactNode } from "react";

type PanelToolbarProps = {
  summary: ReactNode;
  children: ReactNode;
};

export function PanelToolbar({ summary, children }: PanelToolbarProps) {
  return (
    <div className="border-b px-3 py-2 md:px-4 md:py-3">
      <div className="flex min-h-10 w-full flex-col gap-y-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex shrink-0 items-center">{summary}</div>
        <div className="flex w-full min-w-0 flex-col gap-2 lg:w-auto lg:flex-row lg:flex-wrap lg:items-center lg:justify-end">
          {children}
        </div>
      </div>
    </div>
  );
}
