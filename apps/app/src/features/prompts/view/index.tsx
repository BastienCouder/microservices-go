import { PromptsTemplate } from "./template";

type PromptsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PromptsPage({ apiBaseURL, routeSearch }: PromptsPageProps) {
  return <PromptsTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
