import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON, requireGatewayResult } from "@/shared/api/gateway";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";

type InvitationAcceptPageProps = {
  apiBaseURL: string;
};

type AcceptState =
  | { status: "confirm"; message: string }
  | { status: "loading"; message: string }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

export function InvitationAcceptPage({ apiBaseURL }: InvitationAcceptPageProps) {
  const { token = "" } = useParams();
  const invitationToken = useMemo(() => token.trim(), [token]);
  const queryClient = useQueryClient();
  const [state, setState] = useState<AcceptState>({
    status: "confirm",
    message: "Confirmez l'invitation pour rejoindre le projet.",
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async () => {
      if (!invitationToken) {
        throw new Error("Invitation introuvable.");
      }

      const response = await gatewayJSON<unknown>(
        apiBaseURL,
        apiRoutes.organizations.acceptInvitation(invitationToken),
        { method: "POST" },
      );
      requireGatewayResult(response, "Impossible d'accepter cette invitation.");
    },
    onMutate: () => {
      setState({ status: "loading", message: "Acceptation de l'invitation..." });
    },
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ["organizations", apiBaseURL],
        ["organizations", "project-context-hierarchies", apiBaseURL],
      ]);
      setState({
        status: "success",
        message: "Invitation acceptee. Le projet est maintenant disponible.",
      });
    },
    onError: (error) => {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "Impossible d'accepter cette invitation.",
      });
    },
  });

  useEffect(() => {
    if (state.status === "success") {
      pushSuccessToast(state.message);
    }
    if (state.status === "error") {
      pushErrorToast(new Error(state.message), state.message);
    }
  }, [state.message, state.status]);

  const isLoading = acceptInvitationMutation.isPending || state.status === "loading";

  return (
    <main className="mx-auto flex min-h-[calc(100vh-8rem)] w-full max-w-xl items-center px-4 py-8">
      <Dialog open>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Invitation au projet</DialogTitle>
            <DialogDescription>
              Vous avez ete invite. En confirmant, votre compte sera ajoute au projet lie a cette invitation.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            {state.status === "success" ? (
              <Button asChild>
                <Link to="/organizations">Continuer</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" disabled={isLoading}>
                  <Link to="/organizations">Annuler</Link>
                </Button>
                <Button
                  type="button"
                  onClick={() => acceptInvitationMutation.mutate()}
                  disabled={isLoading}
                >
                  {state.status === "error" ? <RotateCw data-icon="inline-start" /> : null}
                  {isLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                  {state.status === "error" ? "Reessayer" : "Confirmer"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
