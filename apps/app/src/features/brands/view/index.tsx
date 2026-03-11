import { BrandsTemplate } from "./template";

type BrandsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandsPage({ apiBaseURL, routeSearch }: BrandsPageProps) {
  return <BrandsTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
