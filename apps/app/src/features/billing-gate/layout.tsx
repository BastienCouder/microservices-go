import { useEffect } from "react";

import { redirectToWebPricing } from "@/shared/auth/web-auth";

type BillingGateLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
  userEmail?: string;
};

export function BillingGateLayout({
  apiBaseURL: _apiBaseURL,
  routeSearch: _routeSearch,
  userEmail: _userEmail,
}: BillingGateLayoutProps) {
  useEffect(() => {
    redirectToWebPricing();
  }, []);

  return (
    <div className="flex min-h-[320px] items-center justify-center p-6 text-sm text-muted-foreground">
      Redirection vers les tarifs...
    </div>
  );
}
