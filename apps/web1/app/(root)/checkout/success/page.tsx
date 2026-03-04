"use client";

import { useEffect, useState } from "react";
import { syncSubscription } from "@/app/actions/sync-subscription";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function SuccessPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  useEffect(() => {
    const sync = async () => {
      try {
        // On attend un peu pour être sûr que Stripe a eu le temps de traiter (race condition)
        await new Promise((resolve) => setTimeout(resolve, 1000));

        const result = await syncSubscription();
        if (result.ok) {
          setStatus("success");
          // Redirection automatique après succès
          setTimeout(() => router.push("/billing"), 2000);
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
        <h1 className="text-3xl font-semibold">Paiement confirmé 🎉</h1>

        {status === "loading" && (
          <div className="flex flex-col items-center gap-2 text-gray-600">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p>Activation de votre abonnement en cours...</p>
          </div>
        )}

        {status === "success" && (
          <div className="text-green-600">
            <p>Votre abonnement est actif !</p>
            <p className="text-sm">Redirection vers la facturation...</p>
          </div>
        )}

        {status === "error" && (
          <div className="text-amber-600">
            <p>Nous n'avons pas pu synchroniser votre abonnement automatiquement.</p>
            <p className="text-sm">Pas d'inquiétude, il sera actif dans quelques instants.</p>
            <button
              onClick={() => router.push("/billing")}
              className="mt-4 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90"
            >
              Retour à la facturation
            </button>
          </div>
        )}

        <p className="mt-8 text-xs text-gray-400">
          ID de session : {typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('session_id') : ''}
        </p>
      </div>
    </main>
  );
}
