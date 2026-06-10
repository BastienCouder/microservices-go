import { PricingPanel } from "./_components/pricing-panel";

type BillingGateLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
  userEmail?: string;
};

export function BillingGateLayout({
  apiBaseURL,
  routeSearch,
  userEmail,
}: BillingGateLayoutProps) {
  return (
    <PricingPanel
      apiBaseURL={apiBaseURL}
      routeSearch={routeSearch}
      userEmail={userEmail}
    />
  );
}
