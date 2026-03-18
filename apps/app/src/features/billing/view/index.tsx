import { BillingTemplate } from "./template";

type BillingPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function BillingPage({ routeSearch }: BillingPageProps) {
  return <BillingTemplate routeSearch={routeSearch} />;
}
