"use client";

import { useCallback, useMemo, useState, type SetStateAction } from "react";

type UseProjectModelSelectionOptions = {
  projectId: string;
  serverModelIds: string[] | undefined;
  catalogModelIDs: Set<string>;
  usableModelIDs: Set<string>;
  enforceUsableFilter: boolean;
};

const EMPTY_MODEL_IDS: string[] = [];

function sameStringArray(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function sanitizeModelSelection(
  modelIds: string[],
  options: {
    catalogModelIDs: Set<string>;
    usableModelIDs: Set<string>;
    enforceUsableFilter: boolean;
  },
): string[] {
  if (!options.enforceUsableFilter) return modelIds;

  return modelIds.filter(
    (modelId) =>
      options.catalogModelIDs.has(modelId) && options.usableModelIDs.has(modelId),
  );
}

function resolveNextSelection(
  next: SetStateAction<string[]>,
  current: string[],
): string[] {
  return typeof next === "function" ? next(current) : next;
}

export function useProjectModelSelection({
  projectId,
  serverModelIds,
  catalogModelIDs,
  usableModelIDs,
  enforceUsableFilter,
}: UseProjectModelSelectionOptions) {
  const [overridesByProject, setOverridesByProject] = useState<
    Record<string, string[]>
  >({});

  const serverSelection = serverModelIds ?? EMPTY_MODEL_IDS;
  const rawSelectedModelIds = useMemo(() => {
    if (!projectId) return EMPTY_MODEL_IDS;
    return overridesByProject[projectId] ?? serverSelection;
  }, [overridesByProject, projectId, serverSelection]);

  const selectedModelIds = useMemo(
    () =>
      sanitizeModelSelection(rawSelectedModelIds, {
        catalogModelIDs,
        usableModelIDs,
        enforceUsableFilter,
      }),
    [catalogModelIDs, enforceUsableFilter, rawSelectedModelIds, usableModelIDs],
  );

  const setSelectedModelIds = useCallback(
    (next: SetStateAction<string[]>) => {
      if (!projectId) return;

      const resolved = resolveNextSelection(next, selectedModelIds);
      setOverridesByProject((current) => {
        const currentForProject = current[projectId] ?? serverSelection;
        if (sameStringArray(currentForProject, resolved)) return current;

        if (sameStringArray(serverSelection, resolved)) {
          if (!(projectId in current)) return current;
          const nextOverrides = { ...current };
          delete nextOverrides[projectId];
          return nextOverrides;
        }

        return { ...current, [projectId]: resolved };
      });
    },
    [projectId, selectedModelIds, serverSelection],
  );

  return { selectedModelIds, setSelectedModelIds };
}
