"use client";

import { useState, FormEvent } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { useStripe, useElements, CardNumberElement, CardExpiryElement, CardCvcElement, Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Loader2, Lock } from "lucide-react";
import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

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

function UpdateForm({ onSuccess, onCancel }: { onSuccess: () => void; onCancel: () => void }) {
    const stripe = useStripe();
    const elements = useElements();
    const [name, setName] = useState("");
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!stripe || !elements) return;
        if (!name.trim()) {
            setError("Merci de renseigner le nom complet");
            return;
        }

        setIsProcessing(true);
        setError(null);

        try {
            const cardNumberElement = elements.getElement(CardNumberElement);
            if (!cardNumberElement) throw new Error("Card element not found");

            // 1. Create Payment Method via Stripe JS
            const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
                type: "card",
                card: cardNumberElement,
                billing_details: { name },
            });

            if (pmError) throw pmError;
            if (!paymentMethod) throw new Error("Failed to create payment method");

            // 2. Send to backend to attach to customer
            await apiFetch(apiRoutes.billing.updatePaymentMethod(), {
                method: "POST",
                body: JSON.stringify({ paymentMethodId: paymentMethod.id }),
            });

            onSuccess();

        } catch (err: any) {
            console.error("Update card error:", err);
            setError(err.message || "Erreur lors de la mise à jour de la carte.");
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nom complet</Label>
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

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Expiration</Label>
                        <div className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                            <CardExpiryElement options={inputStyle} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>CVC</Label>
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

            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <Lock className="h-3 w-3" />
                <p>Vos données bancaires sont sécurisées par Stripe.</p>
            </div>

            <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={onCancel} disabled={isProcessing}>
                    Annuler
                </Button>
                <Button type="submit" disabled={!stripe || isProcessing}>
                    {isProcessing ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Mise à jour...
                        </>
                    ) : (
                        "Enregistrer la nouvelle carte"
                    )}
                </Button>
            </div>
        </form>
    );
}

interface UpdatePaymentMethodDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function UpdatePaymentMethodDialog({ open, onOpenChange }: UpdatePaymentMethodDialogProps) {
    const handleSuccess = () => {
        onOpenChange(false);
        // Optional: show toast
        window.location.reload();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Modifier le moyen de paiement</DialogTitle>
                    <DialogDescription>
                        Entrez les informations de votre nouvelle carte bancaire.
                    </DialogDescription>
                </DialogHeader>
                <Elements stripe={stripePromise}>
                    <UpdateForm onSuccess={handleSuccess} onCancel={() => onOpenChange(false)} />
                </Elements>
            </DialogContent>
        </Dialog>
    );
}
