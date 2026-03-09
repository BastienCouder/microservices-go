import ModelsTemplate from "./template";

type ModelsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ModelsPage({ apiBaseURL, routeSearch }: ModelsPageProps) {
  return <ModelsTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
