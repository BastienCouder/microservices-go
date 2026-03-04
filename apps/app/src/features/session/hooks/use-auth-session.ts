import { useCallback, useEffect, useState } from "react";

import { gatewayJSON } from "@/shared/api/gateway";
import type { SessionInfo, UserProfile } from "@/shared/models";
import { safeJSONStringify } from "@/shared/utils";

type UseAuthSessionResult = {
  busy: boolean;
  session: SessionInfo | null;
  user: UserProfile | null;
  feedback: string;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  createUserProfile: (firstName: string, lastName: string) => Promise<void>;
};

export function useAuthSession(apiBaseURL: string): UseAuthSessionResult {
  const [busy, setBusy] = useState(false);
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [feedback, setFeedback] = useState("");

  const refresh = useCallback(async () => {
    if (!apiBaseURL) {
      setSession(null);
      setUser(null);
      return;
    }

    setBusy(true);
    try {
      const me = await gatewayJSON<SessionInfo>(apiBaseURL, "/auth/me", { method: "GET" });
      if (!me.ok) {
        setSession(null);
        setUser(null);
        setFeedback("");
        if (me.status !== 401) {
          setFeedback(`auth/me: ${me.status} ${me.error}`);
        }
        return;
      }

      setSession(me.data);

      const userMe = await gatewayJSON<UserProfile>(apiBaseURL, "/users/me", { method: "GET" });
      if (!userMe.ok) {
        setUser(null);
        setFeedback("");
        if (userMe.status !== 404) {
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
      if (!response.ok) {
        setFeedback(`logout: ${response.status} ${response.error}`);
      } else {
        setFeedback("Déconnexion effectuée");
      }
    } finally {
      setBusy(false);
      await refresh();
    }
  }, [apiBaseURL, refresh]);

  const createUserProfile = useCallback(
    async (firstName: string, lastName: string) => {
      if (!apiBaseURL || !session) {
        return;
      }
      setBusy(true);
      try {
        const response = await gatewayJSON<unknown>(apiBaseURL, "/users", {
          method: "POST",
          body: JSON.stringify({
            email: session.email,
            first_name: firstName,
            last_name: lastName,
          }),
        });

        if (!response.ok) {
          setFeedback(`users: ${response.status} ${response.error}\n${safeJSONStringify(response.details)}`);
          return;
        }

        setFeedback("Profil utilisateur créé");
      } finally {
        setBusy(false);
        await refresh();
      }
    },
    [apiBaseURL, refresh, session],
  );

  return {
    busy,
    session,
    user,
    feedback,
    refresh,
    logout,
    createUserProfile,
  };
}
