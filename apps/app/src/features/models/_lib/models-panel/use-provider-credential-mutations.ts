"use client";

import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { invalidateProjectScope } from "@/shared/api/query-refresh";

import {
  deleteLLMProviderCredential,
  saveLLMProviderCredential,
} from "../catalog-client";
import type { LLMProviderCredentialStatus } from "../model-access";

type SaveInput = {
  provider: string;
  apiKey: string;
};

type UseProviderCredentialMutationsOptions = {
  apiBaseURL: string;
  organizationId: string;
  projectId: string;
  onSaveSuccess?: (credential: LLMProviderCredentialStatus) => void;
  onDeleteSuccess?: (credential: LLMProviderCredentialStatus) => void;
  onSaveError?: (mutationError: unknown) => void;
  onDeleteError?: (mutationError: unknown) => void;
};

function upsertCredential(
  current: LLMProviderCredentialStatus[] | undefined,
  credential: LLMProviderCredentialStatus,
): LLMProviderCredentialStatus[] {
  const credentials = current ?? [];
  const withoutProvider = credentials.filter(
    (item) => item.provider !== credential.provider,
  );
  return [...withoutProvider, credential];
}

function removeCredential(
  current: LLMProviderCredentialStatus[] | undefined,
  provider: string,
): LLMProviderCredentialStatus[] {
  return (current ?? []).filter((item) => item.provider !== provider);
}

export function useProviderCredentialMutations({
  apiBaseURL,
  organizationId,
  projectId,
  onSaveSuccess,
  onDeleteSuccess,
  onSaveError,
  onDeleteError,
}: UseProviderCredentialMutationsOptions) {
  const queryClient = useQueryClient();
  const [pendingProvider, setPendingProvider] = useState<string | null>(null);
  const providerCredentialsQueryKey = appQueryKeys.llmProviderCredentials(
    apiBaseURL,
    organizationId,
    projectId,
  );

  const saveProviderCredentialMutation = useMutation({
    mutationFn: async ({ provider, apiKey }: SaveInput) => {
      setPendingProvider(provider);
      return saveLLMProviderCredential(
        apiBaseURL,
        organizationId,
        projectId,
        provider,
        apiKey,
      );
    },
    onSuccess: async (credential) => {
      queryClient.setQueryData(
        providerCredentialsQueryKey,
        (current: LLMProviderCredentialStatus[] | undefined) =>
          upsertCredential(current, credential),
      );
      await invalidateProjectScope(
        queryClient,
        apiBaseURL,
        organizationId,
        projectId,
      );
      onSaveSuccess?.(credential);
    },
    onError: (mutationError) => onSaveError?.(mutationError),
    onSettled: () => setPendingProvider(null),
  });

  const deleteProviderCredentialMutation = useMutation({
    mutationFn: async (provider: string) => {
      setPendingProvider(provider);
      return deleteLLMProviderCredential(
        apiBaseURL,
        organizationId,
        projectId,
        provider,
      );
    },
    onSuccess: async (credential) => {
      queryClient.setQueryData(
        providerCredentialsQueryKey,
        (current: LLMProviderCredentialStatus[] | undefined) =>
          removeCredential(current, credential.provider),
      );
      await invalidateProjectScope(
        queryClient,
        apiBaseURL,
        organizationId,
        projectId,
      );
      onDeleteSuccess?.(credential);
    },
    onError: (mutationError) => onDeleteError?.(mutationError),
    onSettled: () => setPendingProvider(null),
  });

  const saveProviderCredential = useCallback(
    (provider: string, apiKey: string) => {
      void saveProviderCredentialMutation.mutateAsync({ provider, apiKey });
    },
    [saveProviderCredentialMutation],
  );

  const deleteProviderCredential = useCallback(
    (provider: string) => {
      void deleteProviderCredentialMutation.mutateAsync(provider);
    },
    [deleteProviderCredentialMutation],
  );

  return {
    pendingProvider,
    saveProviderCredential,
    deleteProviderCredential,
    saveProviderCredentialMutation,
    deleteProviderCredentialMutation,
  };
}
