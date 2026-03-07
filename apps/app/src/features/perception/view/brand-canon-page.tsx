import { PerceptionTemplate } from "./template";

type BrandCanonPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandCanonPage({ apiBaseURL, routeSearch }: BrandCanonPageProps) {
  return <PerceptionTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} brandCanonMode />;
}
