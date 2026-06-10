import { ArrowRight, Check, Gift, Handshake, Loader2, RefreshCw } from "lucide-react";
import { useEffect } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  pushErrorToast,
  pushSuccessToast,
  pushWarningToast,
} from "@/components/ui/toast-actions";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import { cn } from "@/shared/utils";
import type { CheckoutPlan } from "../../_lib/pricing/billing-gate-api";
import { useBillingGateViewModel } from "../../_lib/pricing/use-billing-gate-view-model";

type PricingPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
  userEmail?: string;
};

export function PricingPanel({ apiBaseURL, routeSearch, userEmail }: PricingPanelProps) {
  const { t } = useScopedI18n("billing-gate");
  const viewModel = useBillingGateViewModel({ apiBaseURL, routeSearch, userEmail });

  useEffect(() => {
    if (viewModel.checkoutNotice) {
      const checkoutStatus = new URLSearchParams(routeSearch).get("checkout");
      if (checkoutStatus === "success") {
        pushSuccessToast(viewModel.checkoutNotice);
        return;
      }
      pushWarningToast(viewModel.checkoutNotice);
    }
  }, [routeSearch, viewModel.checkoutNotice]);

  useEffect(() => {
    if (viewModel.actionError) {
      const checkoutStatus = new URLSearchParams(routeSearch).get("checkout");
      if (checkoutStatus === "success" || checkoutStatus === "cancel") {
        return;
      }
      pushErrorToast(new Error(viewModel.actionError), viewModel.actionError);
    }
  }, [routeSearch, viewModel.actionError]);

  const handleCheckout = (plan: CheckoutPlan) => {
    viewModel.startCheckout(plan);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-foreground">
      <header className="border-b border-border/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              {t("eyebrow")}
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              {t("title")}
            </h1>
          </div>

          <div className="inline-flex w-fit rounded-lg border border-border bg-background p-1">
            <Button
              size="sm"
              variant={viewModel.billingCycle === "monthly" ? "default" : "ghost"}
              onClick={() => viewModel.setBillingCycle("monthly")}
            >
              {t("monthly")}
            </Button>
            <Button
              size="sm"
              variant={viewModel.billingCycle === "yearly" ? "default" : "ghost"}
              onClick={() => viewModel.setBillingCycle("yearly")}
            >
              {t("yearly")}
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <section className="space-y-5">
          {!viewModel.hasOrganizations ? (
            <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <label className="text-sm font-medium text-foreground" htmlFor="organization-name">
                {t("organizationName")}
              </label>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4"
                id="organization-name"
                value={viewModel.organizationName}
                onChange={(event) => viewModel.setOrganizationName(event.target.value)}
                placeholder={t("organizationNamePlaceholder")}
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-foreground">{t("activeOrganization")}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {viewModel.organizations.map((organization) => (
                  <Button
                    key={organization.id}
                    size="sm"
                    variant={viewModel.selectedOrganizationId === organization.id ? "default" : "outline"}
                    onClick={() => viewModel.setSelectedOrganizationId(organization.id)}
                  >
                    {organization.name}
                  </Button>
                ))}
              </div>
              {viewModel.billingStatus ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  {t("billingStatus", { status: viewModel.billingStatus })}
                </p>
              ) : null}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {viewModel.plans.map((plan) => (
              <article
                key={plan.id}
                className={cn(
                  "flex min-h-[430px] flex-col rounded-lg border bg-white p-5 shadow-sm",
                  plan.highlighted ? "border-primary shadow-md" : "border-border",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">{plan.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{plan.description}</p>
                  </div>
                  {plan.highlighted ? <Badge>{t("popular")}</Badge> : null}
                </div>

                <div className="mt-6">
                  <p className="text-2xl font-semibold">
                    {viewModel.billingCycle === "yearly" ? plan.yearlyPrice : plan.price}
                    <span className="text-sm font-medium text-muted-foreground"> {t("perMonth")}</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">{plan.quota}</p>
                </div>

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm leading-5 text-foreground">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <Button
                  className="mt-6 w-full"
                  disabled={viewModel.isSubmitting || viewModel.isChecking}
                  onClick={() => handleCheckout(plan.id)}
                >
                  {viewModel.isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ArrowRight className="h-4 w-4" />
                  )}
                  {t("continue")}
                </Button>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("affiliateProgram")}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("affiliateDescription")}
            </p>
            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium">{t("recurringCommission")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("recurringCommissionDescription")}
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium">{t("assistedIntro")}</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {t("assistedIntroDescription")}
                </p>
              </div>
            </div>
            <Button asChild className="mt-5 w-full" variant="outline">
              <a href="mailto:partners@riligar.com?subject=Programme%20affiliation">
                <Gift className="h-4 w-4" />
                {t("becomePartner")}
              </a>
            </Button>
          </section>

          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">{t("afterPayment")}</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {t("afterPaymentDescription")}
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
