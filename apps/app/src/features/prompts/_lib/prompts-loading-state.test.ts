import { describe, expect, test } from "bun:test";

import {
  getPromptsWorkspaceLoadingState,
  readPromptsWorkspaceTab,
} from "./use-prompts-responses-state";

const source = await Bun.file(new URL("./use-prompts-responses-state.ts", import.meta.url)).text();

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

  test("reads the prompts workspace tab from the route search", () => {
    expect(readPromptsWorkspaceTab("?project=fury-defendu&tab=responses")).toBe("responses");
    expect(readPromptsWorkspaceTab("?project=fury-defendu&tab=prompts")).toBe("prompts");
    expect(readPromptsWorkspaceTab("?project=fury-defendu")).toBe("prompts");
  });

  test("falls back to the stored internal organization id when the URL hides org ids", () => {
    expect(source.includes("readSelectedOrganizationID")).toBe(true);
    expect(source.includes("readSelectedOrganizationPublicID")).toBe(false);
  });
});
