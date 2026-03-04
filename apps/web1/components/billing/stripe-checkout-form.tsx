"use client";

import { useState, FormEvent } from "react";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, AlertCircle, Lock } from "lucide-react";
import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";

type PlanType = "pro-monthly" | "pro-yearly";

interface StripeCheckoutFormProps {
    plan: PlanType;
    onSuccess?: () => void;
    onCancel?: () => void;
}

const inputStyle = {
    style: {
        base: {
            fontSize: "16px",
            color: "hsl(var(--foreground))",
            "::placeholder": {
                color: "hsl(var(--muted-foreground))",
            },
            fontFamily: "Inter, system-ui, sans-serif",
        },
        invalid: {
            color: "hsl(var(--destructive))",
        },
    },
};

export default function StripeCheckoutForm({ plan, onSuccess, onCancel }: StripeCheckoutFormProps) {
    const stripe = useStripe();
    const elements = useElements();

    const [name, setName] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const planDetails = {
        "pro-monthly": { label: "Pro Monthly", price: "$10.00" },
        "pro-yearly": { label: "Pro Yearly", price: "$100.00" }
    };

    const getErrorMessage = (error: any) => {
        switch (error?.code) {
            case "card_declined":
                return "Votre carte a été refusée.";
            case "expired_card":
                return "Votre carte a expiré.";
            case "incorrect_cvc":
                return "Le code de sécurité est incorrect.";
            case "processing_error":
                return "Erreur lors du traitement de la carte. Veuillez réessayer.";
            case "insufficient_funds":
                return "Fonds insuffisants sur la carte.";
            case "authentication_required":
                return "L'authentification a échoué.";
            default:
                return error?.message || "Une erreur est survenue lors du paiement.";
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) {
            return;
        }

        if (!name.trim()) {
            setError("Merci de renseigner le nom complet");
            return;
        }

        setIsProcessing(true);
        setError(null);

        let subscriptionId: string | undefined;

        try {
            const cardNumberElement = elements.getElement(CardNumberElement);
            if (!cardNumberElement) {
                throw new Error("Card element not found");
            }

            const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
                type: "card",
                card: cardNumberElement,
                billing_details: {
                    name: name,
                },
            });

            if (pmError) {
                throw pmError; // Throw the Stripe error object directly to use mapping
            }
            if (!paymentMethod) {
                throw new Error("Failed to create payment method");
            }

            // Note: If this fails, no subscription is created in Stripe (or handled by backend error)
            const result = await apiFetch<{ subscriptionId: string; clientSecret?: string } | null>(apiRoutes.billing.createSubscription(), {
                method: "POST",
                body: JSON.stringify({
                    paymentMethodId: paymentMethod.id,
                    plan,
                }),
            });

            subscriptionId = result!.subscriptionId;

            if (result?.clientSecret) {
                const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(result.clientSecret);

                if (confirmError) {
                    throw confirmError;
                }

                if (paymentIntent?.status !== "succeeded") {
                    throw new Error(`Le paiement n'a pas pu être validé (Status: ${paymentIntent?.status})`);
                }
            }

            setSuccess(true);
            setTimeout(() => {
                onSuccess?.();
            }, 2000);

        } catch (err: any) {
            console.error("Payment error:", err);
            console.error("Payment error message:", err.message); // Explicitly log message in case object is empty
            const message = getErrorMessage(err);
            // Debug: append original error message if not 'card_declined' to see what's going on
            const debugMessage = (err?.code !== "card_declined") ? `${message} (${err.message})` : message;
            setError(debugMessage);
            setIsProcessing(false);

            // Cleanup: If we created a subscription but failed the payment (e.g. 3DS fail), cancel it.
            if (subscriptionId) {
                apiFetch(apiRoutes.billing.cancelIncomplete(), {
                    method: "POST",
                    body: JSON.stringify({ subscriptionId }),
                }).catch(e => console.warn("Failed to cleanup incomplete subscription:", e));
            }
        }
    };

    if (success) {
        return (
            <Card className="border-green-500/50">
                <CardContent className="pt-6">
                    <div className="flex flex-col items-center justify-center gap-4 py-8">
                        <CheckCircle2 className="h-16 w-16 text-green-500" />
                        <div className="text-center space-y-2">
                            <h3 className="text-xl font-semibold">Paiement réussi !</h3>
                            <p className="text-muted-foreground">Votre abonnement a été activé avec succès.</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="flex flex-col md:flex-row gap-6">
            {/* Form Section */}
            <Card className="flex-1 border-0 shadow-none md:border md:shadow-sm">
                <CardHeader>
                    <CardTitle>Ajouter un moyen de paiement</CardTitle>
                    <CardDescription>
                        Entrez les détails de votre carte pour finaliser l'abonnement.
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleSubmit}>
                    <CardContent className="space-y-6">

                        <div className="grid gap-4">
                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Nom complet (sur la carte)</Label>
                                    <Input
                                        id="name"
                                        placeholder="John Doe"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="card-number">Numéro de carte</Label>
                                    <div className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                        <CardNumberElement options={{ ...inputStyle, showIcon: true }} />
                                    </div>
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="expiry">Expiration</Label>
                                    <div className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                        <CardExpiryElement options={inputStyle} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="cvc">CVC</Label>
                                    <div className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                                        <CardCvcElement options={inputStyle} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertDescription>{error}</AlertDescription>
                            </Alert>
                        )}

                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Lock className="h-3 w-3" />
                            <p>Paiement sécurisé chiffré SSL. Vos données bancaires ne sont pas stockées.</p>
                        </div>
                    </CardContent>

                    <CardFooter className="flex gap-3 pt-6">
                        {onCancel && (
                            <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing} className="flex-1">
                                Annuler
                            </Button>
                        )}
                        <Button type="submit" disabled={!stripe || isProcessing} className="flex-1">
                            {isProcessing ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    Traitement...
                                </>
                            ) : (
                                `Payer ${planDetails[plan].price} `
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Summary Section (Desktop Only) */}
            <Card className="hidden md:flex flex-col w-80 h-fit bg-muted/30">
                <CardHeader>
                    <CardTitle className="text-lg">Récapitulatif</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="font-medium">{planDetails[plan].label}</p>
                            <p className="text-sm text-muted-foreground">Abonnement</p>
                        </div>
                        <p className="font-medium">{planDetails[plan].price}</p>
                    </div>

                    <div className="border-t pt-4 mt-4 space-y-2">
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Sous-total</span>
                            <span>{planDetails[plan].price}</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Taxes</span>
                            <span>$0.00</span>
                        </div>
                    </div>

                    <div className="border-t pt-4 flex justify-between items-center bg-muted/0">
                        <span className="font-bold">Total</span>
                        <span className="text-xl font-bold text-primary">{planDetails[plan].price}</span>
                    </div>
                </CardContent>
                <CardFooter>
                    <p className="text-xs text-muted-foreground text-center w-full">
                        Renouvellement automatique. Annulable à tout moment.
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}