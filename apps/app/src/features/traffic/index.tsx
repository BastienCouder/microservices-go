import { TrafficLayout } from "./layout";

type TrafficPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function TrafficPage({ apiBaseURL, routeSearch }: TrafficPageProps) {
  return <TrafficLayout apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
