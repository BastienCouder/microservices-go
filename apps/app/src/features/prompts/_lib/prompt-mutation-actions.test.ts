import { describe, expect, test } from "bun:test";

import {
  deletePromptsLocally,
  resolveBulkPromptIds,
} from "./prompt-mutation-actions";

describe("resolveBulkPromptIds", () => {
  test("dedupes selected model rows to their source prompt ids", () => {
    const ids = resolveBulkPromptIds({
      promptRowMode: "model",
      selectedPromptIds: ["prompt-1::gemma", "prompt-1::gpt", "prompt-2::gemma"],
      filteredPromptRows: [
        {
          id: "prompt-1::gemma",
          sourcePromptId: "prompt-1",
        },
        {
          id: "prompt-1::gpt",
          sourcePromptId: "prompt-1",
        },
        {
          id: "prompt-2::gemma",
          sourcePromptId: "prompt-2",
        },
      ] as never,
    });

    expect(ids).toEqual(["prompt-1", "prompt-2"]);
  });
});

describe("deletePromptsLocally", () => {
  test("removes manual prompts, clears matching selections, and deletes server prompts remotely", () => {
    let manualPrompts = [
      { id: "manual-1", sourcePromptId: "manual-1" },
      { id: "server-1", sourcePromptId: "server-1" },
    ] as never[];
    let selectedPromptIds = ["manual-1", "server-1::gemma", "keep-1::gpt"];
    let selectedPromptId: string | null = "server-1::gemma";
    let hiddenPromptIds = ["existing-hidden"];
    const remoteDeletes: string[] = [];

    deletePromptsLocally({
      promptIds: ["manual-1", "server-1"],
      organizationId: "42",
      activeProjectId: "project-1",
      manualPrompts,
      setManualPrompts: (value) => {
        manualPrompts = typeof value === "function" ? value(manualPrompts) : value;
      },
      setSelectedPromptIds: (value) => {
        selectedPromptIds =
          typeof value === "function" ? value(selectedPromptIds) : value;
      },
      setSelectedPromptId: (value) => {
        selectedPromptId =
          typeof value === "function" ? value(selectedPromptId) : value;
      },
      setHiddenPromptIds: (value) => {
        hiddenPromptIds =
          typeof value === "function" ? value(hiddenPromptIds) : value;
      },
      mutateRemote: (promptId) => {
        remoteDeletes.push(promptId);
      },
    });

    expect(manualPrompts).toEqual([]);
    expect(selectedPromptIds).toEqual(["keep-1::gpt"]);
    expect(selectedPromptId).toBeNull();
    expect(hiddenPromptIds).toEqual(["existing-hidden", "server-1"]);
    expect(remoteDeletes).toEqual(["server-1"]);
  });
});
