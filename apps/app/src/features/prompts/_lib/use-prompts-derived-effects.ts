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
  selectedCompetitorsKey: string;
  search: string;
  setSelectedPromptId: (value: string | null | ((current: string | null) => string | null)) => void;
  setResponseVisibleCount: (value: number | ((current: number) => number)) => void;
  filteredResponsesLength: number;
};

export function usePromptsDerivedEffects(params: UsePromptsDerivedEffectsParams) {
  const {
    criticalOnly,
    dateRangeFrom,
    dateRangeTo,
    deferredSearch,
    filteredPromptRows,
    filteredResponsesLength,
    focusPromptId,
    noMentionOnly,
    onlyErrors,
    period,
    promptPage,
    promptRowMode,
    promptSort,
    promptSortDirection,
    promptTotalPages,
    search,
    selectedCompetitorsKey,
    selectedPromptModelsKey,
    selectedResponseModelsKey,
    setPromptPage,
    setResponseVisibleCount,
    setSelectedPromptId,
    setSelectedPromptIds,
    showArchived,
    showHistorical,
  } = params;

  useEffect(() => {
    setPromptPage(1);
  }, [
    dateRangeFrom,
    dateRangeTo,
    deferredSearch,
    period,
    promptRowMode,
    promptSort,
    promptSortDirection,
    selectedPromptModelsKey,
    setPromptPage,
    showArchived,
  ]);

  useEffect(() => {
    setSelectedPromptIds([]);
  }, [promptRowMode, setSelectedPromptIds]);

  useEffect(() => {
    if (promptPage > promptTotalPages) {
      setPromptPage(promptTotalPages);
    }
  }, [promptPage, promptTotalPages, setPromptPage]);

  useEffect(() => {
    const selectablePromptIds = new Set(
      filteredPromptRows.map((item) => getPromptSelectionKey(item, promptRowMode)),
    );
    setSelectedPromptIds((current) => current.filter((id) => selectablePromptIds.has(id)));
    setSelectedPromptId((current) =>
      current && filteredPromptRows.some((item) => item.id === current)
        ? current
        : filteredPromptRows[0]?.id ?? null,
    );
  }, [filteredPromptRows, promptRowMode, setSelectedPromptId, setSelectedPromptIds]);

  useEffect(() => {
    setResponseVisibleCount(RESPONSES_BATCH_SIZE);
  }, [
    criticalOnly,
    dateRangeFrom,
    dateRangeTo,
    focusPromptId,
    noMentionOnly,
    onlyErrors,
    period,
    search,
    selectedCompetitorsKey,
    selectedResponseModelsKey,
    setResponseVisibleCount,
    showHistorical,
  ]);

  useEffect(() => {
    setResponseVisibleCount((current) =>
      Math.min(Math.max(RESPONSES_BATCH_SIZE, current), filteredResponsesLength || RESPONSES_BATCH_SIZE),
    );
  }, [filteredResponsesLength, setResponseVisibleCount]);
}
