import type { ReactNode } from "react";

type PerceptionThreeColumnLayoutProps = {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
};

export function PerceptionThreeColumnLayout({
  left,
  center,
  right,
}: PerceptionThreeColumnLayoutProps) {
  return (
    <div className="flex h-auto min-h-full flex-col gap-4 px-3 pb-6 pt-3 md:px-4 lg:m-4 lg:h-full lg:min-h-0 lg:overflow-y-auto lg:gap-3 lg:px-0 lg:pb-0 lg:pt-0 xl:overflow-hidden">
      <div className="m-0 grid h-auto min-h-full grid-cols-12 gap-4 lg:h-full lg:min-h-0">
        <div className="col-span-12 rounded-md bg-background p-2 md:col-span-4 xl:col-span-3 xl:h-full xl:overflow-hidden">
          {left}
        </div>

        <div className="col-span-12 border-b md:col-span-8 xl:col-span-6 xl:h-full xl:overflow-hidden xl:border-b-0">
          <div className="h-auto xl:h-full xl:overflow-y-auto">{center}</div>
        </div>

        <div className="col-span-12 h-auto xl:col-span-3 xl:h-full xl:overflow-hidden">
          <div className="h-auto xl:h-full xl:overflow-y-auto">{right}</div>
        </div>
      </div>
    </div>
  );
}
