import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { appQueryKeys } from "@/lib/query-keys";
import { gatewayJSON } from "@/shared/api/gateway";
import { translateI18nText } from "@/shared/hooks/use-i18n";
import i18n from "@/shared/i18n";
import { invalidateQueryKeys } from "@/shared/api/query-refresh";
import { navigateToWebAuth } from "@/shared/auth/web-auth";
import type { UserProfile } from "@/shared/models";
import { clearSelectedContext } from "@/shared/selection";

type UseAuthSessionResult = {
  busy: boolean;
  user: UserProfile | null;
  feedback: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

async function loadAuthSession(apiBaseURL: string, signal?: AbortSignal): Promise<UserProfile | null> {
  if (!apiBaseURL) {
    return null;
  }

  const userMe = await gatewayJSON<UserProfile>(apiBaseURL, "/users/me", { method: "GET", signal });
  if (!userMe.ok) {
    if (userMe.status === 401 || userMe.status === 404) {
      return null;
    }
    if (userMe.status >= 500) {
      throw new Error(`users/me: ${userMe.status} ${userMe.error}`);
    }
    return null;
  }

  return userMe.data;
}

export function useAuthSession(apiBaseURL: string): UseAuthSessionResult {
  const [feedback, setFeedback] = useState("");
  const queryClient = useQueryClient();
  const previousUserIdRef = useRef("");

  const sessionQuery = useQuery({
    queryKey: appQueryKeys.session(apiBaseURL),
    enabled: apiBaseURL.trim() !== "",
    queryFn: ({ signal }) => loadAuthSession(apiBaseURL, signal),
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      if (!apiBaseURL) {
        return "";
      }

      const response = await gatewayJSON<unknown>(apiBaseURL, "/auth/logout", { method: "POST" });
      if (!response.ok) {
        return `logout: ${response.status} ${response.error}`;
      }
      return translateI18nText("shared-ui", "loggedOut", i18n.resolvedLanguage || i18n.language || "fr");
    },
    onSuccess: (nextFeedback) => {
      clearSelectedContext();
      queryClient.setQueryData(appQueryKeys.session(apiBaseURL), null);
      setFeedback(nextFeedback);
    },
    onSettled: async () => {
      await invalidateQueryKeys(queryClient, [appQueryKeys.session(apiBaseURL)]);
      navigateToWebAuth();
    },
  });

  const refresh = useCallback(async () => {
    await sessionQuery.refetch();
  }, [sessionQuery.refetch]);

  useEffect(() => {
    if (sessionQuery.error instanceof Error) {
      setFeedback(sessionQuery.error.message);
      return;
    }

    if (sessionQuery.isSuccess && !logoutMutation.isPending) {
      setFeedback("");
    }
  }, [logoutMutation.isPending, sessionQuery.error, sessionQuery.isSuccess]);

  useEffect(() => {
    const nextUserId =
      sessionQuery.data?.ID != null ? String(sessionQuery.data.ID).trim() : "";
    const previousUserId = previousUserIdRef.current;

    if (nextUserId === "") {
      return;
    }

    if (previousUserId !== "" && previousUserId !== nextUserId) {
      clearSelectedContext();
    }

    previousUserIdRef.current = nextUserId;
  }, [sessionQuery.data?.ID]);

  const logout = useCallback(async () => {
    if (!apiBaseURL) {
      return;
    }
    await logoutMutation.mutateAsync();
  }, [apiBaseURL, logoutMutation]);

  return {
    busy: sessionQuery.isLoading || (sessionQuery.isFetching && !sessionQuery.data) || logoutMutation.isPending,
    user: sessionQuery.data ?? null,
    feedback,
    refresh,
    logout,
  };
}
