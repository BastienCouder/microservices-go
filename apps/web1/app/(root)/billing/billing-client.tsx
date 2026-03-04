"use client";

import { useState } from "react";
import { useBilling } from "@/hooks/use-billing-plan";
import { ProfileMe } from "@/types/profile";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { StripeProvider } from "@/components/billing/stripe-provider";
import StripeCheckoutForm from "@/components/billing/stripe-checkout-form";
import { CancelSubscriptionDialog } from "@/components/billing/cancel-subscription-dialog";
import { UpdatePaymentMethodDialog } from "@/components/billing/update-payment-method-dialog";
import InvoiceList from "@/components/billing/invoice-list";
import { X } from "lucide-react";

export default function BillingClient({ profile }: { profile: ProfileMe | null }) {
  const {
    planSlug,
    hasSubscription,
    hasPaidSubscription,
    cancelSubscription,
    isCancelling,
    resumeSubscription,
    isResuming,
  } = useBilling(profile);

  const [showCheckoutForm, setShowCheckoutForm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showUpdateCardDialog, setShowUpdateCardDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<"pro-monthly" | "pro-yearly" | null>(null);

  const isCurrentPlan = (p: string) => planSlug === p;

  const handleSelectPlan = (plan: "pro-monthly" | "pro-yearly") => {
    setSelectedPlan(plan);
    setShowCheckoutForm(true);
  };

  const handleCheckoutSuccess = () => {
    setShowCheckoutForm(false);
    setSelectedPlan(null);
    // Reload the page to get updated subscription status
    window.location.reload();
  };

  const handleCheckoutCancel = () => {
    setShowCheckoutForm(false);
    setSelectedPlan(null);
  };

  // Show checkout form as modal
  if (showCheckoutForm && selectedPlan) {
    return (
      <main className="flex-1 flex items-center justify-center px-4 py-10 bg-background/80 backdrop-blur-sm">
        <div className="max-w-4xl w-full relative">
          <Button
            variant="ghost"
            size="icon"
            className="absolute -top-2 -right-2 z-10"
            onClick={handleCheckoutCancel}
          >
            <X className="h-4 w-4" />
          </Button>
          <StripeProvider>
            <StripeCheckoutForm
              plan={selectedPlan}
              onSuccess={handleCheckoutSuccess}
              onCancel={handleCheckoutCancel}
            />
          </StripeProvider>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col items-center gap-10 px-4 py-10 bg-background">
      <div className="max-w-5xl w-full grid gap-6 md:grid-cols-2">
        {/* FREE PLAN */}
        <Card>
          <CardHeader>
            <CardTitle>Free</CardTitle>
            <CardDescription>Get started with the basics.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">$0</p>
            <p className="text-muted-foreground text-sm mb-4">per month</p>
            <ul className="text-sm space-y-1 list-disc list-inside">
              <li>Core features</li>
              <li>Limited usage</li>
            </ul>
          </CardContent>
          <CardFooter>
            <Button className="w-full" variant="default" disabled>
              {isCurrentPlan("free") ? "Current plan" : "Free"}
            </Button>
          </CardFooter>
        </Card>

        {/* PRO PLAN */}
        <Card className="border-primary/40">
          <CardHeader>
            <CardTitle>Pro</CardTitle>
            <CardDescription>Unlock production-grade limits.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <p className="text-3xl font-semibold">$10</p>
                <p className="text-muted-foreground text-sm mb-1">per month</p>
                <p className="text-xs text-muted-foreground">or $100/year (save $20)</p>
              </div>
              <ul className="text-sm space-y-1 list-disc list-inside">
                <li>All features unlocked</li>
                <li>Priority support</li>
                <li>Advanced analytics</li>
              </ul>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-2">
            <Button
              className="w-full"
              disabled={isCurrentPlan("pro-monthly")}
              onClick={() => handleSelectPlan("pro-monthly")}
            >
              {isCurrentPlan("pro-monthly") ? "Current plan" : "Go Pro Monthly"}
            </Button>

            <Button
              className="w-full"
              variant="outline"
              disabled={isCurrentPlan("pro-yearly")}
              onClick={() => handleSelectPlan("pro-yearly")}
            >
              {isCurrentPlan("pro-yearly") ? "Current plan" : "Go Pro Annual"}
            </Button>

            {hasPaidSubscription && profile && (
              <div className="flex flex-col gap-2 w-full mt-2">
                {profile.cancelAtPeriodEnd ? (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    disabled={isResuming}
                    onClick={resumeSubscription}
                  >
                    {isResuming ? "Réactivation..." : "Réactiver l'abonnement"}
                  </Button>
                ) : (
                  <>
                    <Button
                      className="w-full"
                      variant="outline"
                      onClick={() => setShowUpdateCardDialog(true)}
                    >
                      Modifier ma carte
                    </Button>
                    <Button
                      className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                      variant="ghost"
                      disabled={isCancelling}
                      onClick={() => setShowCancelDialog(true)}
                    >
                      Annuler l'abonnement
                    </Button>
                  </>
                )}
              </div>
            )}
          </CardFooter>
        </Card>
      </div>

      <CancelSubscriptionDialog
        open={showCancelDialog}
        onOpenChange={setShowCancelDialog}
        onConfirm={cancelSubscription}
        isCancelling={isCancelling}
      />

      <UpdatePaymentMethodDialog
        open={showUpdateCardDialog}
        onOpenChange={setShowUpdateCardDialog}
      />
    </main>
  );
}