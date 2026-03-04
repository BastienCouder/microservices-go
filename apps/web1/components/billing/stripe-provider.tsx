"use client";

import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { ReactNode } from "react";

// Initialize Stripe.js with your publishable key
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface StripeProviderProps {
    children: ReactNode;
}

export function StripeProvider({ children }: StripeProviderProps) {
    return (
        <Elements
            stripe={stripePromise}
            options={{
                fonts: [
                    {
                        cssSrc: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap",
                    },
                ],
                appearance: {
                    theme: "stripe",
                    variables: {
                        colorPrimary: "hsl(var(--primary))",
                        colorBackground: "hsl(var(--background))",
                        colorText: "hsl(var(--foreground))",
                        colorDanger: "hsl(var(--destructive))",
                        fontFamily: "Inter, system-ui, sans-serif",
                        spacingUnit: "4px",
                        borderRadius: "8px",
                    },
                },
            }}
        >
            {children}
        </Elements>
    );
}
