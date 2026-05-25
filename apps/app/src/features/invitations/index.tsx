import { useCallback, useEffect, useMemo, useState } from "react";
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
import { gatewayJSON } from "@/shared/api/gateway";

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
  const [state, setState] = useState<AcceptState>({
    status: "confirm",
    message: "Confirmez l'invitation pour rejoindre le projet.",
  });

  const acceptInvitation = useCallback(async () => {
    if (!invitationToken) {
      setState({ status: "error", message: "Invitation introuvable." });
      return;
    }

    setState({ status: "loading", message: "Acceptation de l'invitation..." });
    const response = await gatewayJSON<unknown>(
      apiBaseURL,
      apiRoutes.organizations.acceptInvitation(invitationToken),
      { method: "POST" },
    );

    if (!response.ok) {
      setState({
        status: "error",
        message: response.error || "Impossible d'accepter cette invitation.",
      });
      return;
    }

    setState({
      status: "success",
      message: "Invitation acceptee. Le projet est maintenant disponible.",
    });
  }, [apiBaseURL, invitationToken]);

  useEffect(() => {
    if (state.status === "success") {
      pushSuccessToast(state.message);
    }
    if (state.status === "error") {
      pushErrorToast(new Error(state.message), state.message);
    }
  }, [state.message, state.status]);

  const isLoading = state.status === "loading";

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
                <Button type="button" onClick={acceptInvitation} disabled={isLoading}>
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
