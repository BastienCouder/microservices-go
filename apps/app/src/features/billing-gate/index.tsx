import type { UserProfile } from "@/shared/models";
import { BillingGateLayout } from "./layout";

type BillingGatePageProps = {
  apiBaseURL: string;
  routeSearch?: string;
  user: UserProfile | null;
};

export function BillingGatePage({
  apiBaseURL,
  routeSearch = "",
  user,
}: BillingGatePageProps) {
  return (
    <BillingGateLayout
      apiBaseURL={apiBaseURL}
      routeSearch={routeSearch}
      userEmail={user?.Email}
    />
  );
}
