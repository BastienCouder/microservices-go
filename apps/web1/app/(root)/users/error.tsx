"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <main className="flex-1 p-8 max-w-6xl mx-auto flex items-center justify-center min-h-[400px]">
            <div className="max-w-md w-full space-y-6">
                <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Une erreur est survenue</AlertTitle>
                    <AlertDescription>
                        Impossible de charger la liste des utilisateurs.
                    </AlertDescription>
                </Alert>

                <div className="flex justify-center">
                    <Button onClick={() => reset()} variant="outline">
                        Réessayer
                    </Button>
                </div>
            </div>
        </main>
    );
}
