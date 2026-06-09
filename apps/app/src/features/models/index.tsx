import { ModelsLayout } from "./layout";

type ModelsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ModelsPage({ apiBaseURL, routeSearch }: ModelsPageProps) {
  return <ModelsLayout apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
