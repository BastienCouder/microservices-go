import { TrafficReportPanel } from "./_components/report";

type TrafficLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function TrafficLayout({ apiBaseURL, routeSearch }: TrafficLayoutProps) {
  return (
    <div className="flex h-auto min-h-full flex-col gap-4 px-3 pb-6 pt-3 md:px-4 lg:m-4 lg:h-full lg:min-h-0 lg:px-0 lg:pb-0 lg:pt-0">
      <TrafficReportPanel apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
    </div>
  );
}
