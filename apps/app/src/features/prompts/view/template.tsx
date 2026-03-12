import { PromptsClient } from "./client";

type PromptsTemplateProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function PromptsTemplate({ apiBaseURL, routeSearch }: PromptsTemplateProps) {
  return <PromptsClient apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
