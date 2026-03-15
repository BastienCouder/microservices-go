import { OptimizeActionsTemplate } from "./template";

type OptimizeActionsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function OptimizeActionsPage({ apiBaseURL, routeSearch }: OptimizeActionsPageProps) {
  return <OptimizeActionsTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
