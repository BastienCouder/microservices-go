import { useLayoutEffect } from "react";

import { redirectToWebPricing } from "@/shared/auth/web-auth";

type BillingGateLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
  userEmail?: string;
};

export function BillingGateLayout(props: BillingGateLayoutProps) {
  void props;

  useLayoutEffect(() => {
    redirectToWebPricing();
  }, []);

  return (
    <div className="min-h-[320px]" aria-hidden="true" />
  );
}
