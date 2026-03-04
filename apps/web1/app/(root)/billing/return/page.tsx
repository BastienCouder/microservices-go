"use client";

import { useEffect, useState } from "react";
import { syncSubscription } from "@/app/actions/sync-subscription";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function BillingReturnPage() {
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

    useEffect(() => {
        const sync = async () => {
            try {
                // Petit délai pour laisser le temps à Stripe de propager les events
                await new Promise((resolve) => setTimeout(resolve, 1000));

                const result = await syncSubscription();
                if (result.ok) {
                    setStatus("success");
                    // Redirection vers le compte
                    setTimeout(() => router.push("/account"), 1500);
                } else {
                    setStatus("error");
                }
            } catch (e) {
                setStatus("error");
            }
        };

        sync();
    }, [router]);

    return (
        <main className="min-h-dvh grid place-items-center p-6">
            <div className="text-center max-w-md space-y-4">
                {status === "loading" && (
                    <div className="flex flex-col items-center gap-2 text-gray-600">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p>Mise à jour de votre abonnement...</p>
                    </div>
                )}

                {status === "success" && (
                    <div className="text-green-600">
                        <p>Abonnement mis à jour !</p>
                        <p className="text-sm">Retour à votre compte...</p>
                    </div>
                )}

                {status === "error" && (
                    <div className="text-amber-600">
                        <p>Impossible de synchroniser immédiatement.</p>
                        <button
                            onClick={() => router.push("/account")}
                            className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
                        >
                            Retour au compte
                        </button>
                    </div>
                )}
            </div>
        </main>
    );
}
