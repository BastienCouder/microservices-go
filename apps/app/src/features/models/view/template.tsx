import { ModelsClient } from "./client";

type ModelsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ModelsTemplate({ apiBaseURL, routeSearch }: ModelsTemplateProps) {
  return <ModelsClient apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}

export default ModelsTemplate;
