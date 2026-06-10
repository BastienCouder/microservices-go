import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
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
  const { t } = useScopedI18n("invitations");
  const { token = "" } = useParams();
  const invitationToken = useMemo(() => token.trim(), [token]);
  const queryClient = useQueryClient();
  const [state, setState] = useState<AcceptState>({
    status: "confirm",
    message: t("confirmMessage"),
  });

  const acceptInvitationMutation = useMutation({
    mutationFn: async () => {
      if (!invitationToken) {
        throw new Error(t("notFound"));
      }

      const response = await gatewayJSON<unknown>(
        apiBaseURL,
        apiRoutes.organizations.acceptInvitation(invitationToken),
        { method: "POST" },
      );
      requireGatewayResult(response, t("acceptError"));
    },
    onMutate: () => {
      setState({ status: "loading", message: t("accepting") });
    },
    onSuccess: async () => {
      await invalidateQueryKeys(queryClient, [
        ["organizations", apiBaseURL],
        ["organizations", "project-context-hierarchies", apiBaseURL],
      ]);
      setState({
        status: "success",
        message: t("accepted"),
      });
    },
    onError: (error) => {
      setState({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : t("acceptError"),
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
            <DialogTitle>{t("dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            {state.status === "success" ? (
              <Button asChild>
                <Link to="/organizations">{t("continue")}</Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="outline" disabled={isLoading}>
                  <Link to="/organizations">{t("cancel")}</Link>
                </Button>
                <Button
                  type="button"
                  onClick={() => acceptInvitationMutation.mutate()}
                  disabled={isLoading}
                >
                  {state.status === "error" ? <RotateCw data-icon="inline-start" /> : null}
                  {isLoading ? <Loader2 className="animate-spin" data-icon="inline-start" /> : null}
                  {state.status === "error" ? t("retry") : t("confirm")}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
