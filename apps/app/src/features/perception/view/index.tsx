import { PerceptionTemplate } from "./template";

type PerceptionPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PerceptionPage({ apiBaseURL, routeSearch }: PerceptionPageProps) {
  return <PerceptionTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
