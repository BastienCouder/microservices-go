"use client";

import { useBilling } from "@/hooks/use-billing-plan";
import { ProfileMe } from "@/types/profile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CreditCard, User, Calendar, ShieldCheck, ExternalLink } from "lucide-react";
import { CancelSubscriptionDialog } from "@/components/billing/cancel-subscription-dialog";
import { useState } from "react";

export default function AccountClient({ profile }: { profile: ProfileMe }) {
  const {
    currentPlanLabel,
    hasPaidSubscription,
    nextBillingDate,
    willEndAtPeriodEnd,
    resumeSubscription,
    isResuming,
    cancelSubscription,
    isCancelling,
  } = useBilling(profile);

  const [showCancelDialog, setShowCancelDialog] = useState(false);

  const initials = profile.displayName
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

  return (
    <main className="flex-1 p-8 max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mon Compte</h1>
        <p className="text-muted-foreground mt-2">
          Gérez vos informations personnelles et votre abonnement.
        </p>
      </div>

      <div className="grid gap-8 md:grid-cols-2">
        {/* Profil Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Profil
            </CardTitle>
            <CardDescription>Vos informations personnelles</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center sm:items-start sm:text-left sm:flex-row gap-6">
            <Avatar className="h-24 w-24 border-2 border-muted">
              <AvatarImage src={profile.avatarUrl || ""} alt={profile.displayName || ""} />
              <AvatarFallback className="text-xl bg-primary/10 text-primary">{initials}</AvatarFallback>
            </Avatar>
            <div className="space-y-1 py-2">
              <h3 className="font-medium text-xl">{profile.displayName || "Utilisateur"}</h3>
              <p className="text-sm text-muted-foreground">{profile.email || "Pas d'email"}</p>
              <div className="pt-2">
                <span className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80">
                  Membre
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subscription Card */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Abonnement
            </CardTitle>
            <CardDescription>Gérez votre plan et facturation</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Plan actuel</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-bold text-primary">{currentPlanLabel}</p>
                  {hasPaidSubscription && (
                    <ShieldCheck className="h-5 w-5 text-green-500" />
                  )}
                </div>
              </div>
              {/* Status Badge */}
              <div className={`px-3 py-1 rounded-full text-xs font-medium border ${hasPaidSubscription
                ? willEndAtPeriodEnd
                  ? "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800"
                  : "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800"
                : "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700"
                }`}>
                {hasPaidSubscription
                  ? willEndAtPeriodEnd ? "Annulation programmée" : "Actif"
                  : "Gratuit"
                }
              </div>
            </div>

            {hasPaidSubscription && nextBillingDate && (
              <div className="flex items-start gap-3 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 mt-0.5" />
                <p>
                  {willEndAtPeriodEnd
                    ? `Votre accès prendra fin le ${nextBillingDate}.`
                    : `Prochain renouvellement le ${nextBillingDate}.`}
                </p>
              </div>
            )}
          </CardContent>
          <CardFooter className="border-t bg-muted/10 pt-6">
            {hasPaidSubscription ? (
              willEndAtPeriodEnd ? (
                <Button
                  className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white"
                  disabled={isResuming}
                  onClick={resumeSubscription}
                >
                  {isResuming ? "Réactivation..." : "Réactiver l'abonnement"}
                </Button>
              ) : (
                <Button
                  className="w-full sm:w-auto text-destructive border-destructive hover:bg-destructive/10"
                  variant="outline"
                  disabled={isCancelling}
                  onClick={() => setShowCancelDialog(true)}
                >
                  Annuler l'abonnement
                </Button>
              )
            ) : (
              null
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
    </main>
  );
}
