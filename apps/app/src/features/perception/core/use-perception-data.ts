import { useCallback, useEffect, useState } from "react";

import { loadPerceptionData, type PerceptionViewData } from "@/lib/perception-data";

type UsePerceptionDataResult = {
  data: PerceptionViewData | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export function usePerceptionData(apiBaseURL: string, routeSearch: string): UsePerceptionDataResult {
  const [data, setData] = useState<PerceptionViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(async () => {
    setReloadToken((value) => value + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    void loadPerceptionData(apiBaseURL, routeSearch, { signal: controller.signal })
      .then((result) => {
        if (!active) return;
        setData(result.data);
      })
      .catch((err) => {
        if (!active || controller.signal.aborted) return;
        setError(err instanceof Error ? err.message : "Impossible de charger la page Perception.");
      })
      .finally(() => {
        if (!active) return;
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [apiBaseURL, reloadToken, routeSearch]);

  return { data, loading, error, reload };
}
