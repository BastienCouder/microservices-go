import { useEffect, useMemo } from "react";

import type { PromptItem, SavePromptEditorInput } from "../types";
import { usePromptsResponsesState } from "../use-prompts-responses-state";

type UsePromptsWorkspacePanelViewModelInput = {
  apiBaseURL: string;
  routeSearch: string;
};

export function findPromptEditorSource(
  promptId: string | undefined,
  canonicalPrompts: PromptItem[],
  visiblePrompts: PromptItem[],
) {
  if (!promptId) return null;
  const matchesPromptId = (item: PromptItem) => (item.sourcePromptId || item.id) === promptId;
  return canonicalPrompts.find(matchesPromptId) ?? visiblePrompts.find(matchesPromptId) ?? null;
}

export function usePromptsWorkspacePanelViewModel({
  apiBaseURL,
  routeSearch,
}: UsePromptsWorkspacePanelViewModelInput) {
  const state = usePromptsResponsesState(apiBaseURL, routeSearch);
  const { setFocusPromptId, setSelectedResponseId, setTab } = state;

  const responseDeepLink = useMemo(() => {
    const params = new URLSearchParams(
      routeSearch.startsWith("?") ? routeSearch.slice(1) : routeSearch,
    );

    return {
      focusPromptId: params.get("focusPromptId") || "",
      responseId: params.get("responseId") || "",
      tab: params.get("tab") || "",
    };
  }, [routeSearch]);

  const editorPrompt =
    state.promptEditorState?.mode === "edit"
      ? findPromptEditorSource(
          state.promptEditorState.promptId,
          state.editorPrompts,
          state.prompts,
        )
      : null;
  const activePromptCount = useMemo(
    () => state.prompts.filter((item) => item.status === "active").length,
    [state.prompts],
  );

  useEffect(() => {
    if (responseDeepLink.tab !== "responses" && !responseDeepLink.responseId) return;

    setTab("responses");
    if (responseDeepLink.focusPromptId) {
      setFocusPromptId(responseDeepLink.focusPromptId);
    }
    if (responseDeepLink.responseId) {
      setSelectedResponseId(responseDeepLink.responseId);
    }
  }, [
    responseDeepLink.focusPromptId,
    responseDeepLink.responseId,
    responseDeepLink.tab,
    setFocusPromptId,
    setSelectedResponseId,
    setTab,
  ]);

  return {
    ...state,
    activePromptCount,
    editorPrompt,
    saveCurrentPromptEditor: (input: Omit<SavePromptEditorInput, "mode" | "promptId">) =>
      state.savePromptEditor({
        ...input,
        mode: state.promptEditorState?.mode ?? "create",
        promptId: editorPrompt?.sourcePromptId || editorPrompt?.id,
      }),
    openPromptDetailsEditor: (promptId: string) => {
      state.setIsPromptDetailsOpen(false);
      state.openEditPromptEditor(promptId);
    },
    showPromptResponses: (promptId: string) => {
      state.setIsPromptDetailsOpen(false);
      state.setTab("responses");
      state.setFocusPromptId(promptId);
    },
    showPromptResponse: (promptId: string, responseId: string) => {
      state.setIsPromptDetailsOpen(false);
      state.setTab("responses");
      state.setFocusPromptId(promptId);
      state.setSelectedResponseId(responseId);
    },
  };
}
