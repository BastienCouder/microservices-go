import { ArrowRight, Check, Gift, Handshake, Loader2, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/shared/utils";
import type { CheckoutPlan } from "../../_lib/pricing/billing-gate-api";
import { useBillingGateViewModel } from "../../_lib/pricing/use-billing-gate-view-model";

type PricingPanelProps = {
  apiBaseURL: string;
  routeSearch: string;
  userEmail?: string;
};

export function PricingPanel({ apiBaseURL, routeSearch, userEmail }: PricingPanelProps) {
  const viewModel = useBillingGateViewModel({ apiBaseURL, routeSearch, userEmail });

  const handleCheckout = (plan: CheckoutPlan) => {
    viewModel.startCheckout(plan);
  };

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-foreground">
      <header className="border-b border-border/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">
              Activation du compte
            </p>
            <h1 className="mt-1 text-2xl font-semibold text-foreground">
              Choisis ton accès avant d'entrer dans l'app
            </h1>
          </div>

          <div className="inline-flex w-fit rounded-lg border border-border bg-background p-1">
            <Button
              size="sm"
              variant={viewModel.billingCycle === "monthly" ? "default" : "ghost"}
              onClick={() => viewModel.setBillingCycle("monthly")}
            >
              Mensuel
            </Button>
            <Button
              size="sm"
              variant={viewModel.billingCycle === "yearly" ? "default" : "ghost"}
              onClick={() => viewModel.setBillingCycle("yearly")}
            >
              Annuel
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <section className="space-y-5">
          {viewModel.checkoutNotice ? (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-primary">
              {viewModel.checkoutNotice}
            </div>
          ) : null}

          {viewModel.error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {viewModel.error}
            </div>
          ) : null}

          {!viewModel.hasOrganizations ? (
            <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <label className="text-sm font-medium text-foreground" htmlFor="organization-name">
                Nom de l'organisation
              </label>
              <input
                className="mt-2 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none ring-primary/20 transition focus:ring-4"
                id="organization-name"
                value={viewModel.organizationName}
                onChange={(event) => viewModel.setOrganizationName(event.target.value)}
                placeholder="Ex: Acme SEO"
              />
            </div>
          ) : (
            <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <p className="text-sm font-medium text-foreground">Organisation active</p>
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
                  Statut billing actuel : {viewModel.billingStatus}
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
                  {plan.highlighted ? <Badge>Populaire</Badge> : null}
                </div>

                <div className="mt-6">
                  <p className="text-2xl font-semibold">
                    {viewModel.billingCycle === "yearly" ? plan.yearlyPrice : plan.price}
                    <span className="text-sm font-medium text-muted-foreground"> / mois</span>
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
                  Continuer
                </Button>
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <Handshake className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Programme affiliation</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Recommande la plateforme a une equipe marketing ou une agence et suis les introductions qualifiees.
            </p>
            <div className="mt-5 space-y-3">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium">Commission recurrente</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Jusqu'a 20% sur les comptes apportes et actives.
                </p>
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <p className="text-sm font-medium">Intro assistee</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  Partage une opportunite, l'equipe prend le relais sur la demo.
                </p>
              </div>
            </div>
            <Button asChild className="mt-5 w-full" variant="outline">
              <a href="mailto:partners@riligar.com?subject=Programme%20affiliation">
                <Gift className="h-4 w-4" />
                Devenir partenaire
              </a>
            </Button>
          </section>

          <section className="rounded-lg border border-border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Apres paiement</h2>
            </div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              Une fois Stripe confirme, les comptes avec organisation payee sont rediriges vers l'app.
            </p>
          </section>
        </aside>
      </main>
    </div>
  );
}
