import { useMutation, useQueryClient } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";

const DEFAULT_UPDATE_ERROR = "Impossible de mettre a jour les modeles du projet.";

function sanitizeLegacyModelUpdateError(rawError?: string): string {
  const normalized = rawError?.trim();
  if (
    !normalized ||
    normalized.toLowerCase().includes("monthly model change limit reached")
  ) {
    return DEFAULT_UPDATE_ERROR;
  }
  return normalized;
}

type UseSaveProjectModelsMutationOptions = {
  apiBaseURL: string;
  organizationId: string;
  selectedProjectId: string;
  onSuccessMessage: (message: string) => void;
  onErrorMessage: (message: string) => void;
};

export function useSaveProjectModelsMutation({
  apiBaseURL,
  organizationId,
  selectedProjectId,
  onSuccessMessage,
  onErrorMessage,
}: UseSaveProjectModelsMutationOptions) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (modelIds: string[]) => {
      const response = await fetch(
        `${apiBaseURL.replace(/\/$/, "")}/projects/${selectedProjectId}/models`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "X-Organization-ID": organizationId,
          },
          body: JSON.stringify({ modelIds }),
          credentials: "include",
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!response.ok) throw new Error(sanitizeLegacyModelUpdateError(payload?.error));
      return modelIds;
    },
    onSuccess: async (nextModelIds) => {
      const projectModelsKey = appQueryKeys.projectModels(
        apiBaseURL,
        organizationId,
        selectedProjectId,
      );
      queryClient.setQueryData(projectModelsKey, nextModelIds);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: projectModelsKey }),
        queryClient.invalidateQueries({
          queryKey: ["monitoring", apiBaseURL, selectedProjectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["perception", apiBaseURL, selectedProjectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["prompts", apiBaseURL, organizationId, selectedProjectId],
        }),
        queryClient.invalidateQueries({
          queryKey: ["prompts", "catalog", apiBaseURL, organizationId, selectedProjectId],
        }),
      ]);
      onSuccessMessage("Modeles du projet mis a jour.");
    },
    onError: (mutationError) => {
      onErrorMessage(
        mutationError instanceof Error
          ? mutationError.message
          : DEFAULT_UPDATE_ERROR,
      );
    },
  });
}
