import { useCallback, useEffect, useState } from "react";

import { gatewayJSON } from "@/shared/api/gateway";
import { navigateToWebAuth } from "@/shared/auth/web-auth";
import type { UserProfile } from "@/shared/models";

type UseAuthSessionResult = {
  busy: boolean;
  user: UserProfile | null;
  feedback: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

export function useAuthSession(apiBaseURL: string): UseAuthSessionResult {
  const [busy, setBusy] = useState(false);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [feedback, setFeedback] = useState("");

  const refresh = useCallback(async () => {
    if (!apiBaseURL) {
      setUser(null);
      return;
    }

    setBusy(true);
    try {
      const userMe = await gatewayJSON<UserProfile>(apiBaseURL, "/users/me", { method: "GET" });
      if (!userMe.ok) {
        if (userMe.status === 401) {
          setUser(null);
          setFeedback("");
          return;
        }
        setUser(null);
        if (userMe.status === 404) {
          setFeedback("");
          return;
        }
        if (userMe.status >= 500) {
          setFeedback(`users/me: ${userMe.status} ${userMe.error}`);
        }
        return;
      }

      setUser(userMe.data);
      setFeedback("");
    } finally {
      setBusy(false);
    }
  }, [apiBaseURL]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    if (!apiBaseURL) {
      return;
    }
    setBusy(true);
    try {
      const response = await gatewayJSON<unknown>(apiBaseURL, "/auth/logout", { method: "POST" });
      setUser(null);
      if (!response.ok) {
        setFeedback(`logout: ${response.status} ${response.error}`);
      } else {
        setFeedback("Déconnexion effectuée");
      }
    } finally {
      setBusy(false);
      navigateToWebAuth();
    }
  }, [apiBaseURL]);

  return {
    busy,
    user,
    feedback,
    refresh,
    logout,
  };
}
