import { ImpactTemplate } from "./template";

type ImpactPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ImpactPage({ apiBaseURL, routeSearch }: ImpactPageProps) {
  return <ImpactTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
