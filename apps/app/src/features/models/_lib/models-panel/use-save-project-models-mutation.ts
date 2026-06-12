import { useMutation, useQueryClient } from "@tanstack/react-query";

import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";
import { invalidateProjectScope } from "@/shared/api/query-refresh";

function sanitizeLegacyModelUpdateError(
  rawError: string | undefined,
  defaultErrorMessage: string,
): string {
  const normalized = rawError?.trim();
  if (
    !normalized ||
    normalized.toLowerCase().includes("monthly model change limit reached")
  ) {
    return defaultErrorMessage;
  }
  return normalized;
}

type UseSaveProjectModelsMutationOptions = {
  apiBaseURL: string;
  organizationId: string;
  selectedProjectId: string;
  successMessage: string;
  defaultErrorMessage: string;
  onSuccessMessage: (message: string) => void;
  onErrorMessage: (message: string) => void;
};

export function useSaveProjectModelsMutation({
  apiBaseURL,
  organizationId,
  selectedProjectId,
  successMessage,
  defaultErrorMessage,
  onSuccessMessage,
  onErrorMessage,
}: UseSaveProjectModelsMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (modelIds: string[]) => {
      const response = await gatewayJSON<
        | { error?: string }
        | null
      >(apiBaseURL, apiRoutes.projects.models(selectedProjectId), {
        method: "PATCH",
        organizationId,
        body: JSON.stringify({ modelIds }),
      });

      if (!response.ok) {
        throw new Error(
          sanitizeLegacyModelUpdateError(response.error, defaultErrorMessage),
        );
      }
      return modelIds;
    },
    onSuccess: async () => {
      await invalidateProjectScope(
        queryClient,
        apiBaseURL,
        organizationId,
        selectedProjectId,
      );
      onSuccessMessage(successMessage);
    },
    onError: (mutationError) => {
      onErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : defaultErrorMessage,
      );
    },
  });
}
