import { BrandsOverviewPanel } from "./_components/overview";

type BrandsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BrandsPage({ apiBaseURL, routeSearch }: BrandsPageProps) {
  return <BrandsOverviewPanel apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
