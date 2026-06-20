import type { DateRange } from "react-day-picker";
import type {
  AIModel,
  PeriodKey,
  PromptItem,
  PromptRowMode,
  PromptSort,
  PromptSortDirection,
} from "./types";
import { getPromptSelectionKey, PROMPT_SORT_DEFAULT_DIRECTION, RESPONSES_BATCH_SIZE } from "./prompt-normalizers";
import { DEFAULT_PROMPT_PERIOD } from "./utils";

export function buildPromptsDerivedActions(params: {
  allModelsSelected: boolean;
  tab: "prompts" | "responses";
  promptRowMode: PromptRowMode;
  filteredPrompts: PromptItem[];
  filteredResponsesLength: number;
  promptSort: PromptSort;
  promptAvailableModels: AIModel[];
  responseAvailableModels: AIModel[];
  setPeriod: (value: PeriodKey) => void;
  setDateRange: (value: DateRange | undefined) => void;
  setSelectedPromptModels: (value: AIModel[] | ((current: AIModel[]) => AIModel[])) => void;
  setSelectedResponseModels: (value: AIModel[] | ((current: AIModel[]) => AIModel[])) => void;
  setPersona: (value: "all" | string) => void;
  setShowArchived: (value: boolean) => void;
  setSearch: (value: string) => void;
  setOnlyErrors: (value: boolean) => void;
  setCriticalOnly: (value: boolean) => void;
  setNoMentionOnly: (value: boolean) => void;
  setShowHistorical: (value: boolean) => void;
  setSelectedCompetitors: (value: string[] | ((current: string[]) => string[])) => void;
  setFocusPromptId: (value: string | null) => void;
  setPromptPage: (value: number) => void;
  setSelectedPromptIds: (value: string[] | ((current: string[]) => string[])) => void;
  setPromptSort: (value: PromptSort) => void;
  setPromptSortDirection: (value: PromptSortDirection | ((current: PromptSortDirection) => PromptSortDirection)) => void;
  setResponseVisibleCount: (value: number | ((current: number) => number)) => void;
}) {
  const clearFilters = () => {
    params.setPeriod(DEFAULT_PROMPT_PERIOD);
    params.setDateRange(undefined);
    params.setSelectedPromptModels([]);
    params.setSelectedResponseModels([]);
    params.setPersona("all");
    params.setShowArchived(false);
    params.setSearch("");
    params.setOnlyErrors(false);
    params.setCriticalOnly(false);
    params.setNoMentionOnly(false);
    params.setShowHistorical(true);
    params.setSelectedCompetitors([]);
    params.setFocusPromptId(null);
    params.setPromptPage(1);
  };

  const toggleModel = (model: AIModel) => {
    if (params.allModelsSelected) {
      if (params.tab === "responses") {
        params.setSelectedResponseModels([model]);
      } else {
        params.setSelectedPromptModels([model]);
      }
      return;
    }

    const apply = (current: AIModel[]) =>
      current.includes(model)
        ? current.filter((item) => item !== model)
        : [...current, model];

    if (params.tab === "responses") {
      params.setSelectedResponseModels(apply);
      return;
    }

    params.setSelectedPromptModels(apply);
  };

  const togglePromptSelection = (id: string) => {
    params.setSelectedPromptIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  };

  const toggleSelectAllPrompts = (checked: boolean) => {
    if (!checked) {
      params.setSelectedPromptIds([]);
      return;
    }
    params.setSelectedPromptIds(
      Array.from(new Set(params.filteredPrompts.map((item) => getPromptSelectionKey(item, params.promptRowMode)))),
    );
  };

  const changePromptSort = (nextSort: PromptSort) => {
    if (params.promptSort === nextSort) {
      params.setPromptSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    params.setPromptSort(nextSort);
    params.setPromptSortDirection(PROMPT_SORT_DEFAULT_DIRECTION[nextSort]);
  };

  const loadMoreResponses = () => {
    params.setResponseVisibleCount((current) =>
      Math.min(current + RESPONSES_BATCH_SIZE, params.filteredResponsesLength),
    );
  };

  return {
    clearFilters,
    toggleModel,
    togglePromptSelection,
    toggleSelectAllPrompts,
    changePromptSort,
    loadMoreResponses,
  };
}
