import { ArrowRight, Check, Loader2 } from "lucide-react";
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
  embedded?: boolean;
  organizationId?: string;
  routeSearch: string;
  showOrganizationPicker?: boolean;
  userEmail?: string;
};

export function PricingPanel({
  apiBaseURL,
  embedded = false,
  organizationId,
  routeSearch,
  showOrganizationPicker = true,
  userEmail,
}: PricingPanelProps) {
  const { t } = useScopedI18n("billing-gate");
  const viewModel = useBillingGateViewModel({
    apiBaseURL,
    organizationId,
    routeSearch,
    userEmail,
  });

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
    if (plan === "enterprise") {
      window.location.href = "mailto:sales@riligar.com?subject=Enterprise%20plan";
      return;
    }
    viewModel.startCheckout(plan);
  };

  return (
    <div className={cn("text-foreground", embedded ? "" : "min-h-screen bg-background")}>
      <main className={cn("mx-auto w-full", embedded ? "py-1" : "max-w-[1400px] px-6 py-16 lg:px-12 lg:py-20")}>
        <section className="relative">
          {!embedded ? (
            <div className="mb-8 max-w-3xl lg:mb-10">
              <h1 className="font-display text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                {t("title")}
              </h1>
              <p className="mt-5 text-base leading-7 text-muted-foreground sm:text-lg">
                {t("description")}
              </p>
            </div>
          ) : null}

          <div
            className={cn(
              "mb-8 flex",
              embedded
                ? "justify-end"
                : "flex-col gap-4 rounded-2xl border border-foreground/10 bg-background p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5 lg:mb-10",
            )}
          >
            {!embedded ? (
              <div>
                <p className="text-sm font-medium text-foreground">
                  {viewModel.billingCycle === "yearly"
                    ? t("annualHelper")
                    : t("monthlyHelper")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {viewModel.billingStatus
                    ? t("billingStatus", { status: viewModel.billingStatus })
                    : t("pricingSource")}
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 rounded-full border border-foreground/10 bg-muted/40 p-1">
              <button
                type="button"
                onClick={() => viewModel.setBillingCycle("monthly")}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all",
                  viewModel.billingCycle === "monthly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t("monthly")}
              </button>
              <button
                type="button"
                onClick={() => viewModel.setBillingCycle("yearly")}
                className={cn(
                  "rounded-full px-5 py-2 text-sm font-medium transition-all",
                  viewModel.billingCycle === "yearly"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span>{t("yearly")}</span>
                <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                  {t("annualBadge")}
                </span>
              </button>
            </div>
          </div>

          {showOrganizationPicker ? (
            !viewModel.hasOrganizations ? (
              <div className="mb-8 rounded-2xl border border-foreground/10 bg-background p-5">
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
              <div className="mb-8 rounded-2xl border border-foreground/10 bg-background p-5">
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
              </div>
            )
          ) : null}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {viewModel.plans.map((plan) => {
              const price =
                viewModel.billingCycle === "yearly"
                  ? plan.yearlyPrice
                  : plan.price;

              return (
                <article
                  key={plan.id}
                  className={cn(
                    "relative flex min-h-[520px] flex-col rounded-2xl bg-background p-8 lg:p-10",
                    plan.highlighted
                      ? "border-2 border-primary xl:-my-4 xl:py-12"
                      : "border border-foreground/10",
                  )}
                >
                  {plan.highlighted ? (
                    <Badge className="absolute right-5 top-5">{t("popular")}</Badge>
                  ) : null}

                  <h2 className="text-2xl font-semibold text-foreground">{plan.name}</h2>
                  <p className="mt-3 min-h-[72px] text-sm leading-6 text-muted-foreground">
                    {plan.description}
                  </p>

                  <div className="mt-8">
                    <div className="flex items-end gap-2">
                      <span className="text-4xl font-semibold tracking-tight text-foreground">
                        {price}
                      </span>
                      {!plan.custom ? (
                        <span className="pb-1 text-sm font-medium text-muted-foreground">
                          {t("perMonth")}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 min-h-[22px] text-sm text-muted-foreground">
                      {viewModel.billingCycle === "yearly" && plan.annualBillingText
                        ? plan.annualBillingText
                        : plan.quota}
                    </p>
                  </div>

                  <ul className="mt-8 flex-1 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-3 text-sm leading-6 text-foreground">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-primary" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="mt-8 w-full"
                    disabled={!plan.custom && (viewModel.isSubmitting || viewModel.isChecking)}
                    onClick={() => handleCheckout(plan.id)}
                    variant={plan.highlighted ? "default" : "outline"}
                  >
                    {viewModel.isSubmitting && !plan.custom ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowRight className="h-4 w-4" />
                    )}
                    {plan.custom ? t("contactSales") : t("continue")}
                  </Button>
                </article>
              );
            })}
          </div>
        </section>
      </main>
    </div>
  );
}
