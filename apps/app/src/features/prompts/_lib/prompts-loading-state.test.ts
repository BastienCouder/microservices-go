import { describe, expect, test } from "bun:test";

import { getPromptsWorkspaceLoadingState } from "./use-prompts-responses-state";

describe("getPromptsWorkspaceLoadingState", () => {
  test("uses data skeletons for initial monitoring or prompt catalog loading", () => {
    expect(
      getPromptsWorkspaceLoadingState({
        monitoringLoading: true,
        promptsCatalogInitialLoading: false,
        promptMutationPending: false,
      }),
    ).toEqual({
      promptsDataLoading: true,
      responsesDataLoading: true,
      promptsBusy: true,
    });

    expect(
      getPromptsWorkspaceLoadingState({
        monitoringLoading: false,
        promptsCatalogInitialLoading: true,
        promptMutationPending: false,
      }),
    ).toEqual({
      promptsDataLoading: true,
      responsesDataLoading: false,
      promptsBusy: true,
    });
  });

  test("keeps existing data visible during prompt mutations", () => {
    expect(
      getPromptsWorkspaceLoadingState({
        monitoringLoading: false,
        promptsCatalogInitialLoading: false,
        promptMutationPending: true,
      }),
    ).toEqual({
      promptsDataLoading: false,
      responsesDataLoading: false,
      promptsBusy: true,
    });
  });
});
