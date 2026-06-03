import { useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRoutes } from "@/lib/api-config";
import { appQueryKeys } from "@/lib/query-keys";
import { pushErrorToast, pushSuccessToast } from "@/components/ui/toast-actions";
import { gatewayJSON, requireGatewayResult } from "@/shared/api/gateway";
import type { UserProfile } from "@/shared/models";
import { buildAccountProfileViewData } from "./account-profile-view-data";

type UseAccountProfileViewModelInput = {
  apiBaseURL: string;
  busy: boolean;
  user: UserProfile | null;
  onLogout?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
};

export type AccountProfileUpdateInput = {
  firstName: string;
  lastName: string;
};

async function updateAccountProfile(
  apiBaseURL: string,
  input: AccountProfileUpdateInput,
): Promise<UserProfile> {
  const response = await gatewayJSON<UserProfile>(apiBaseURL, apiRoutes.users.me(), {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return requireGatewayResult(response, "Impossible de mettre a jour le compte.");
}

async function deleteAccount(apiBaseURL: string): Promise<void> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.users.deleteMe(), {
    method: "DELETE",
  });
  requireGatewayResult(response, "Impossible de supprimer le compte.");
}

export function useAccountProfileViewModel({
  apiBaseURL,
  busy,
  user,
  onLogout,
  onRefresh,
}: UseAccountProfileViewModelInput) {
  const queryClient = useQueryClient();
  const profile = useMemo(() => (user ? buildAccountProfileViewData(user) : null), [user]);
  const updateProfileMutation = useMutation({
    mutationFn: (input: AccountProfileUpdateInput) => updateAccountProfile(apiBaseURL, input),
    onSuccess: (updatedUser) => {
      queryClient.setQueryData(appQueryKeys.session(apiBaseURL), updatedUser);
      pushSuccessToast("Compte mis a jour.");
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de mettre a jour le compte.");
    },
  });
  const deleteAccountMutation = useMutation({
    mutationFn: () => deleteAccount(apiBaseURL),
    onSuccess: async () => {
      queryClient.setQueryData(appQueryKeys.session(apiBaseURL), null);
      pushSuccessToast("Compte supprime.");
      await onLogout?.();
    },
    onError: (error) => {
      pushErrorToast(error, "Impossible de supprimer le compte.");
    },
  });

  return {
    busy: busy || updateProfileMutation.isPending || deleteAccountMutation.isPending,
    profile,
    onLogout,
    onRefresh,
    onDeleteAccount: () => deleteAccountMutation.mutate(),
    onUpdateProfile: (input: AccountProfileUpdateInput) => updateProfileMutation.mutate(input),
  };
}
