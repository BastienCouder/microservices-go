"use client";

import { useEffect } from "react";
import type { PromptItem, PromptRowMode } from "./types";
import { RESPONSES_BATCH_SIZE, getPromptSelectionKey } from "./prompt-normalizers";

type UsePromptsDerivedEffectsParams = {
  deferredSearch: string;
  period: string;
  dateRangeFrom?: string;
  dateRangeTo?: string;
  selectedPromptModelsKey: string;
  promptRowMode: PromptRowMode;
  showArchived: boolean;
  promptSort: string;
  promptSortDirection: string;
  setPromptPage: (value: number) => void;
  setSelectedPromptIds: (value: string[] | ((current: string[]) => string[])) => void;
  promptPage: number;
  promptTotalPages: number;
  filteredPromptRows: PromptItem[];
  selectedResponseModelsKey: string;
  focusPromptId: string | null;
  noMentionOnly: boolean;
  onlyErrors: boolean;
  criticalOnly: boolean;
  showHistorical: boolean;
  topCompetitor: string;
  search: string;
  setSelectedPromptId: (value: string | null | ((current: string | null) => string | null)) => void;
  setResponseVisibleCount: (value: number | ((current: number) => number)) => void;
  filteredResponsesLength: number;
};

export function usePromptsDerivedEffects(params: UsePromptsDerivedEffectsParams) {
  useEffect(() => {
    params.setPromptPage(1);
  }, [
    params.dateRangeFrom,
    params.dateRangeTo,
    params.deferredSearch,
    params.period,
    params.promptRowMode,
    params.promptSort,
    params.promptSortDirection,
    params.selectedPromptModelsKey,
    params.setPromptPage,
    params.showArchived,
  ]);

  useEffect(() => {
    params.setSelectedPromptIds([]);
  }, [params.promptRowMode, params.setSelectedPromptIds]);

  useEffect(() => {
    if (params.promptPage > params.promptTotalPages) {
      params.setPromptPage(params.promptTotalPages);
    }
  }, [params.promptPage, params.promptTotalPages, params.setPromptPage]);

  useEffect(() => {
    const selectablePromptIds = new Set(
      params.filteredPromptRows.map((item) => getPromptSelectionKey(item, params.promptRowMode)),
    );
    params.setSelectedPromptIds((current) => current.filter((id) => selectablePromptIds.has(id)));
    params.setSelectedPromptId((current) =>
      current && params.filteredPromptRows.some((item) => item.id === current)
        ? current
        : params.filteredPromptRows[0]?.id ?? null,
    );
  }, [params.filteredPromptRows, params.promptRowMode, params.setSelectedPromptId, params.setSelectedPromptIds]);

  useEffect(() => {
    params.setResponseVisibleCount(RESPONSES_BATCH_SIZE);
  }, [
    params.criticalOnly,
    params.dateRangeFrom,
    params.dateRangeTo,
    params.focusPromptId,
    params.noMentionOnly,
    params.onlyErrors,
    params.period,
    params.search,
    params.selectedResponseModelsKey,
    params.setResponseVisibleCount,
    params.showHistorical,
    params.topCompetitor,
  ]);

  useEffect(() => {
    params.setResponseVisibleCount((current) =>
      Math.min(Math.max(RESPONSES_BATCH_SIZE, current), params.filteredResponsesLength || RESPONSES_BATCH_SIZE),
    );
  }, [params.filteredResponsesLength, params.setResponseVisibleCount]);
}
