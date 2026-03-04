import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface CancelSubscriptionDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onConfirm: (immediate: boolean) => void;
    isCancelling: boolean;
}

export function CancelSubscriptionDialog({
    open,
    onOpenChange,
    onConfirm,
    isCancelling,
}: CancelSubscriptionDialogProps) {
    const [immediate, setImmediate] = useState(false);

    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Êtes-vous sûr de vouloir annuler votre abonnement ?</AlertDialogTitle>
                    <AlertDialogDescription className="space-y-4">
                        <p>
                            Cette action mettra fin au renouvellement automatique. Vous continuerez à avoir accès aux fonctionnalités Pro jusqu'à la fin de la période de facturation en cours.
                        </p>

                        <div className="flex items-center space-x-2 border p-3 rounded-md bg-destructive/10 border-destructive/20">
                            <Checkbox
                                id="immediate"
                                checked={immediate}
                                onCheckedChange={(c) => setImmediate(!!c)}
                            />
                            <div className="grid gap-1.5 leading-none">
                                <label
                                    htmlFor="immediate"
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-destructive"
                                >
                                    Annuler immédiatement (perte d'accès instantanée)
                                </label>
                                <p className="text-xs text-muted-foreground">
                                    Attention : Cette action est irréversible et coupe l'accès instantanément. Aucun remboursement ne sera effectué pour la période restante.
                                </p>
                            </div>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel disabled={isCancelling}>Retour</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={(e) => {
                            e.preventDefault();
                            onConfirm(immediate);
                        }}
                        disabled={isCancelling}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                        {isCancelling ? "Annulation en cours..." : "Confirmer l'annulation"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
