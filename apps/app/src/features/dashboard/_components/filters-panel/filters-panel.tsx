"use client";

import { useCallback, useMemo, useState } from "react";
import type { DashboardPrompt } from "@/hooks/use-dashboard-data";
import { useDashboardData } from "@/hooks/use-dashboard-data";
import { useDashboardStore } from "@/lib/dashboard-store";
import { useShallow } from "zustand/react/shallow";
import { matchesPromptAudienceFilters, promptIsInPeriodWithDateRange } from "../analytics-panel/analytics-utils";
import { FiltersPanelExpanded } from "./filters-panel-expanded";

type FilterModelItem = {
  id: string;
  name: string;
  provider?: string;
  description: string;
  icon: string;
  live: boolean;
  memberIds: string[];
};

export function FiltersPanel() {
  const { data: dashboardData } = useDashboardData();
  const { project, models, recent_prompts } = dashboardData;
  const {
    period,
    setPeriod,
    dateRange,
    setDateRange,
    selectedModels,
    showUniqueModelFilters,
    setShowUniqueModelFilters,
    toggleModel,
    selectedPersonas,
    togglePersona,
    clearPersonas,
    selectedCompetitors,
    toggleCompetitor,
    clearCompetitors,
    resetFilters,
  } = useDashboardStore(
    useShallow((state) => ({
      period: state.period,
      setPeriod: state.setPeriod,
      dateRange: state.dateRange,
      setDateRange: state.setDateRange,
      selectedModels: state.selectedModels,
      showUniqueModelFilters: state.showUniqueModelFilters,
      setShowUniqueModelFilters: state.setShowUniqueModelFilters,
      toggleModel: state.toggleModel,
      selectedPersonas: state.selectedPersonas,
      togglePersona: state.togglePersona,
      clearPersonas: state.clearPersonas,
      selectedCompetitors: state.selectedCompetitors,
      toggleCompetitor: state.toggleCompetitor,
      clearCompetitors: state.clearCompetitors,
      resetFilters: state.resetFilters,
    })),
  );

  const personaOptions = useMemo(
    () =>
      Array.from(
        new Set(
          recent_prompts
            .map((prompt) => prompt.persona.trim())
            .filter(Boolean),
        ),
      ).map((persona) => ({
        id: persona,
        label: persona.charAt(0).toUpperCase() + persona.slice(1),
      })),
    [recent_prompts],
  );

  const localizedModels = useMemo(
    () =>
      models.map((model) => ({
        ...model,
        name: model.name,
        description: model.description ?? "",
      })),
    [models],
  );

  const filteredModels = useMemo(() => localizedModels.filter((m) => m.live), [localizedModels]);

  const getModelFamily = useCallback((model: (typeof localizedModels)[number]) => {
    const label = (model.name || "").trim();
    const lower = label.toLowerCase();
    if (lower.startsWith("chatgpt")) return { key: "chatgpt", label: "ChatGPT" };
    if (lower.startsWith("gemini")) return { key: "gemini", label: "Gemini" };
    if (lower.startsWith("claude")) return { key: "claude", label: "Claude" };
    if (lower.startsWith("perplexity")) return { key: "perplexity", label: "Perplexity" };
    if (lower.startsWith("mistral")) return { key: "mistral", label: "Mistral" };
    if (lower.startsWith("copilot")) return { key: "copilot", label: "Copilot" };

    const provider = (model.provider || "").toLowerCase();
    if (provider === "openai") return { key: "chatgpt", label: "ChatGPT" };
    if (provider === "google") return { key: "gemini", label: "Gemini" };
    if (provider === "anthropic") return { key: "claude", label: "Claude" };
    if (provider) return { key: provider, label: model.provider || provider };

    const firstWord = label.split(/\s+/)[0] || model.id;
    return { key: firstWord.toLowerCase(), label: firstWord };
  }, [localizedModels]);

  const groupedFilterModels = useMemo<FilterModelItem[]>(() => {
    const groups = new Map<string, FilterModelItem>();
    for (const model of filteredModels) {
      const family = getModelFamily(model);
      const current = groups.get(family.key);
      if (!current) {
        groups.set(family.key, {
          id: family.key,
          name: family.label,
          provider: family.label,
          description: "",
          icon: model.icon,
          live: true,
          memberIds: [model.id],
        });
        continue;
      }
      current.memberIds.push(model.id);
      current.description = "";
    }
    return Array.from(groups.values());
  }, [filteredModels, getModelFamily]);

  const visibleModelFilterItems = useMemo<FilterModelItem[]>(
    () =>
      showUniqueModelFilters
        ? filteredModels.map((m) => ({ ...m, memberIds: [m.id] }))
        : groupedFilterModels,
    [filteredModels, groupedFilterModels, showUniqueModelFilters],
  );

  const selectedModelFilterIds = useMemo(() => {
    if (showUniqueModelFilters) return selectedModels;
    return visibleModelFilterItems
      .filter((item) => item.memberIds.every((id) => selectedModels.includes(id)))
      .map((item) => item.id);
  }, [showUniqueModelFilters, selectedModels, visibleModelFilterItems]);

  const toggleModelFilter = useCallback((filterId: string) => {
    const item = visibleModelFilterItems.find((m) => m.id === filterId);
    if (!item) return;
    const allSelected = item.memberIds.every((id) => selectedModels.includes(id));
    if (allSelected) {
      item.memberIds
        .filter((id) => selectedModels.includes(id))
        .forEach((id) => toggleModel(id));
      return;
    }
    item.memberIds
      .filter((id) => !selectedModels.includes(id))
      .forEach((id) => toggleModel(id));
  }, [visibleModelFilterItems, selectedModels, toggleModel]);

  const clearModels = useCallback(() => {
    selectedModels.forEach((id) => toggleModel(id));
  }, [selectedModels, toggleModel]);

  const hasActiveFilters = useMemo(
    () =>
      period !== "7d" ||
      dateRange !== undefined ||
      selectedModels.length > 0 ||
      showUniqueModelFilters ||
      selectedPersonas.length > 0 ||
      selectedCompetitors.length > 0,
    [
      period,
      dateRange,
      selectedModels.length,
      showUniqueModelFilters,
      selectedPersonas.length,
      selectedCompetitors.length,
    ],
  );

  const projectWithDynamicCompetitors = useMemo(() => {
    const normalizeName = (value: string) => value.trim().toLowerCase();
    const competitorMentionCount = (prompts: DashboardPrompt[], competitorName: string) =>
      prompts.filter((prompt) =>
        (prompt.competitorsMentioned || []).some((name) => normalizeName(name) === normalizeName(competitorName)),
      ).length;
    const competitorMentionRate = (prompts: DashboardPrompt[], competitorName: string) => {
      if (prompts.length === 0) return 0;
      return (competitorMentionCount(prompts, competitorName) / prompts.length) * 100;
    };

    const getRangeBounds = (targetPeriod: string) => {
      const now = new Date();
      const end = new Date(now);
      const start = new Date(now);
      if (targetPeriod === "today" || targetPeriod === "24h") {
        start.setHours(start.getHours() - 24);
      } else if (targetPeriod === "7d") {
        start.setDate(start.getDate() - 7);
      } else if (targetPeriod === "14d") {
        start.setDate(start.getDate() - 14);
      } else if (targetPeriod === "30d") {
        start.setDate(start.getDate() - 30);
      } else if (targetPeriod === "90d") {
        start.setDate(start.getDate() - 90);
      } else if (targetPeriod === "custom" && dateRange?.from) {
        const from = new Date(dateRange.from);
        from.setHours(0, 0, 0, 0);
        const to = new Date(dateRange.to ?? dateRange.from);
        to.setHours(23, 59, 59, 999);
        return { start: from, end: to };
      } else {
        start.setDate(start.getDate() - 7);
      }
      return { start, end };
    };

    const inExplicitRange = (prompt: DashboardPrompt, start: Date, end: Date) => {
      if (!prompt.createdAt) return false;
      const d = new Date(prompt.createdAt);
      if (Number.isNaN(d.getTime())) return false;
      return d >= start && d <= end;
    };

    const scopedPrompts = recent_prompts.filter((prompt) =>
      matchesPromptAudienceFilters(prompt, selectedModels, selectedPersonas, []),
    );
    const periodPrompts = scopedPrompts.filter((prompt) =>
      promptIsInPeriodWithDateRange(prompt, period, dateRange),
    );
    const currentRange = getRangeBounds(period);
    const rangeMs = Math.max(1, currentRange.end.getTime() - currentRange.start.getTime());
    const previousRange = {
      start: new Date(currentRange.start.getTime() - rangeMs),
      end: new Date(currentRange.start.getTime() - 1),
    };
    const previousPeriodPrompts = scopedPrompts.filter((prompt) =>
      inExplicitRange(prompt, previousRange.start, previousRange.end),
    );
    const competitorMentions = project.competitors.map((competitor) => ({
      name: competitor.name,
      mentions: competitorMentionCount(periodPrompts, competitor.name),
      previousMentions: competitorMentionCount(previousPeriodPrompts, competitor.name),
      mentionRate: competitorMentionRate(periodPrompts, competitor.name),
      previousMentionRate: competitorMentionRate(previousPeriodPrompts, competitor.name),
    }));

    const totalMentions = competitorMentions.reduce((sum, item) => sum + item.mentions, 0);
    const competitorMap = new Map(
      competitorMentions.map((item) => [
        item.name,
        totalMentions > 0 ? Number(((item.mentions / totalMentions) * 100).toFixed(1)) : 0,
      ]),
    );

    return {
      ...project,
      competitors: project.competitors.map((competitor) => ({
        ...competitor,
        sov: competitorMap.get(competitor.name) ?? competitor.sov,
        trend: (() => {
          const current = competitorMentions.find((item) => item.name === competitor.name);
          const deltaRate = (current?.mentionRate ?? 0) - (current?.previousMentionRate ?? 0);
          if (deltaRate > 0.5) return "up";
          if (deltaRate < -0.5) return "down";

          const deltaMentions = (current?.mentions ?? 0) - (current?.previousMentions ?? 0);
          if (deltaMentions > 0) return "up";
          if (deltaMentions < 0) return "down";

          return competitor.trend ?? "stable";
        })(),
      })),
    };
  }, [project, recent_prompts, selectedModels, selectedPersonas, period, dateRange]);

  const [showAllModels, setShowAllModels] = useState(false);
  const [showAllPersonas, setShowAllPersonas] = useState(false);
  const [showAllCompetitors, setShowAllCompetitors] = useState(false);

  return (
    <FiltersPanelExpanded
      project={projectWithDynamicCompetitors}
      period={period}
      setPeriod={setPeriod}
      dateRange={dateRange}
      setDateRange={setDateRange}
      personaOptions={personaOptions}
      selectedPersonas={selectedPersonas}
      togglePersona={togglePersona}
      clearPersonas={clearPersonas}
      models={visibleModelFilterItems}
      selectedModels={selectedModelFilterIds}
      toggleModel={toggleModelFilter}
      clearModels={clearModels}
      selectedCompetitors={selectedCompetitors}
      toggleCompetitor={toggleCompetitor}
      clearCompetitors={clearCompetitors}
      showAllModels={showAllModels}
      setShowAllModels={setShowAllModels}
      showAllPersonas={showAllPersonas}
      setShowAllPersonas={setShowAllPersonas}
      showAllCompetitors={showAllCompetitors}
      setShowAllCompetitors={setShowAllCompetitors}
      onResetFilters={resetFilters}
      showResetFilters={hasActiveFilters}
      showUniqueModelFilters={showUniqueModelFilters}
      onToggleModelFilterMode={() => setShowUniqueModelFilters(!showUniqueModelFilters)}
    />
  );
}
