"use client";
import { useState } from "react";
import type { ReactNode } from "react";
import { motion } from "framer-motion";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronsUpDown,
  TrendingUp,
} from "lucide-react";

import { cn } from "@/lib/utils";

type LinearHeroCardProps = {
  children: ReactNode;
  title?: string;
  description?: string;
  eyebrow?: string;
  status?: string;
  priority?: string;
  assignee?: string;
  className?: string;
};

const sidebarNavSections = [
  {
    title: "Monitoring",
    indent: true,
    items: [
      { label: "Vue d’ensemble", active: true },
      { label: "Prompts suivis", active: false },
      { label: "Réponses IA", active: false },
      { label: "Pages citées", active: false },
    ],
  },
  {
    title: undefined,
    indent: false,
    items: [{ label: "Perception", active: false }],
  },
  {
    title: "Optimisation",
    indent: true,
    items: [
      { label: "Optimisation contenu", active: false },
      { label: "Audit du site", active: false },
      { label: "Problèmes détectés", active: false },
    ],
  },
  {
    title: undefined,
    indent: false,
    items: [{ label: "Trafic", active: false }],
  },
] as const;

function LinearSidebarNavItem({
  label,
  active,
  indent,
}: {
  label: string;
  active: boolean;
  indent: boolean;
}) {
  return (
    <div className="relative flex items-center">
      {indent ? <div className="w-[22px] shrink-0" /> : null}
      <span
        className={cn(
          "relative flex flex-1 items-center rounded-[5px] px-2 py-1.5 text-sm font-medium transition-colors duration-150",
          active
            ? "bg-white/14 text-white"
            : "text-white/78 hover:bg-white/10 hover:text-white",
        )}
      >
        {label}
      </span>
    </div>
  );
}

const kpis = [
  {
    title: "Mention rate",
    value: "64%",
    sub: "Nike est citée dans 128 réponses IA.",
    trend: "+12%",
    trendDir: "up",
    active: true,
  },
  {
    title: "Visibility score",
    value: "78",
    sub: "Score moyen pondéré par modèle.",
    trend: "+6",
    trendDir: "up",
    active: false,
  },
  {
    title: "Avg. position",
    value: "#2.4",
    sub: "Position moyenne dans les réponses.",
    trend: "-0.8",
    trendDir: "down",
    active: false,
  },
] as const;

const models = [
  { id: "openai", group: "OpenAI", name: "GPT-4o", icon: "/models/openai.svg" },
  { id: "anthropic", group: "Anthropic", name: "Claude 3.5", icon: "/models/anthropic.svg" },
  { id: "google", group: "Google", name: "Gemini", icon: "/models/google.svg" },
  { id: "perplexity", group: "Perplexity", name: "Sonar", icon: "/models/perplexity.svg" },
] as const;

const competitors = [
  { id: "adidas", name: "Adidas", value: "42.8%" },
  { id: "puma", name: "Puma", value: "31.4%" },
  { id: "new-balance", name: "New Balance", value: "18.6%" },
] as const;

const visibilityBars = [
  { id: "openai", label: "OpenAI", value: 84, color: "bg-primary" },
  { id: "perplexity", label: "Perplexity", value: 71, color: "bg-primary/80" },
  { id: "anthropic", label: "Claude", value: 62, color: "bg-primary/65" },
  { id: "google", label: "Gemini", value: 48, color: "bg-primary/45" },
] as const;

const brandRows = [
  { id: "nike", label: "Nike", sov: 38, mention: 72, color: "bg-primary" },
  { id: "adidas", label: "Adidas", sov: 27, mention: 58, color: "bg-[#8db7ff]" },
  { id: "puma", label: "Puma", sov: 19, mention: 42, color: "bg-[#b9c8e8]" },
  { id: "new-balance", label: "New Balance", sov: 14, mention: 33, color: "bg-[#d7def0]" },
] as const;

const prompts = [
  {
    modelId: "openai",
    model: "OpenAI",
    name: "GPT-4o",
    icon: "/models/openai.svg",
    time: "10:42",
    text: "Quelle marque recommander pour des chaussures de running performantes ?",
    score: 92,
    status: "Mentionné",
    rank: "#1",
  },
  {
    modelId: "perplexity",
    model: "Perplexity",
    name: "Sonar",
    icon: "/models/perplexity.svg",
    time: "09:18",
    text: "Compare Nike, Adidas et Puma pour un équipement de marathon.",
    score: 76,
    status: "Mentionné",
    rank: "#3",
  },
  {
    modelId: "anthropic",
    model: "Claude",
    name: "3.5 Sonnet",
    icon: "/models/anthropic.svg",
    time: "08:57",
    text: "Quels critères regarder avant d'acheter une paire de sneakers lifestyle ?",
    score: 58,
    status: "Manqué",
    rank: "",
  },
] as const;

const periodOptions = [
  { value: "7d", label: "7 derniers jours", shortLabel: "7j", mentionRate: "58%", trend: "+5%" },
  { value: "30d", label: "30 derniers jours", shortLabel: "30j", mentionRate: "64%", trend: "+12%" },
  { value: "90d", label: "90 derniers jours", shortLabel: "90j", mentionRate: "71%", trend: "+18%" },
] as const;

type ModelId = (typeof models)[number]["id"];
type CompetitorId = (typeof competitors)[number]["id"];
type PeriodValue = (typeof periodOptions)[number]["value"];
type BrandMetric = "sov" | "mention";

function SectionTitleReplica({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-sm font-bold uppercase text-primary">
      <span
        aria-hidden="true"
        className="relative flex h-2.5 w-2.5 items-center justify-center text-primary"
      >
        <span className="absolute inset-0 rotate-45 bg-current opacity-35" />
        <svg
          viewBox="0 0 10 10"
          className="relative h-2.5 w-2.5 fill-current"
          focusable="false"
        >
          <polygon points="5,1 9,5 5,9 1,5" />
        </svg>
      </span>
      <span>{children}</span>
    </span>
  );
}

type KpiCardReplicaProps = {
  title: string;
  value: string;
  sub: string;
  trend: string;
  trendDir: "up" | "down" | "stable";
  active: boolean;
};

function KpiCardReplica({
  title,
  value,
  sub,
  trend,
  trendDir,
  active,
}: KpiCardReplicaProps) {
  const TrendIcon =
    trendDir === "up" ? ArrowUpRight : trendDir === "down" ? ArrowDownRight : ArrowRight;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-md p-3 transition-all",
        active
          ? "bg-linear-to-br from-primary via-primary to-primary/80 text-primary-foreground shadow-[inset_0_1px_0_hsl(var(--primary-foreground)/0.14)]"
          : "bg-card text-card-foreground",
      )}
    >
      <div className="mb-2 flex items-start justify-between">
        <span
          className={cn(
            "text-xs font-medium leading-tight",
            active ? "text-primary-foreground/90" : "text-muted-foreground",
          )}
        >
          {title}
        </span>
        <div
          className={cn(
            "flex h-7 w-7 items-center justify-center rounded-full border",
            active
              ? "border-transparent bg-white/20 text-white"
              : "border-border bg-background text-foreground",
          )}
        >
          <TrendIcon className="h-3.5 w-3.5" />
        </div>
      </div>
      <span className="text-2xl font-bold tracking-tight">{value}</span>
      <div className="mt-2 flex items-center gap-2">
        <span
          className={cn(
            "flex min-h-6 items-center rounded-[10px] px-2 py-1 text-[10px] font-bold",
            active
              ? "bg-white/20 text-white"
              : trendDir === "up"
                ? "bg-green-100 text-green-700"
                : "bg-red-100 text-red-700",
          )}
        >
          <TrendingUp
            className={cn("mr-1 h-3 w-3", trendDir === "down" && "rotate-180")}
          />
          {trend}
        </span>
      </div>
      <span
        className={cn(
          "mt-2 text-[11px] leading-relaxed",
          active ? "text-primary-foreground/80" : "text-muted-foreground",
        )}
      >
        {sub}
      </span>
    </div>
  );
}

type FilterColumnReplicaProps = {
  period: PeriodValue;
  selectedModelIds: ModelId[];
  selectedCompetitorIds: CompetitorId[];
  onPeriodChange: (value: PeriodValue) => void;
  onModelToggle: (value: ModelId) => void;
  onClearModels: () => void;
  onCompetitorToggle: (value: CompetitorId) => void;
  onResetFilters: () => void;
};

function FilterColumnReplica({
  period,
  selectedModelIds,
  selectedCompetitorIds,
  onPeriodChange,
  onModelToggle,
  onClearModels,
  onCompetitorToggle,
  onResetFilters,
}: FilterColumnReplicaProps) {
  const activePeriod =
    periodOptions.find((option) => option.value === period) ?? periodOptions[1];

  return (
    <div className="h-full min-h-0 overflow-hidden rounded-md bg-white p-2">
      <div className="h-full min-h-0 overflow-y-auto p-2 no-scrollbar">
        <div className="flex flex-col gap-5 pb-4">
          <section className="relative hidden flex-col overflow-hidden rounded-md bg-linear-to-br from-primary via-primary to-primary/80 p-4 text-primary-foreground xl:flex">

            <div className="relative z-10 mb-5 flex items-start justify-between gap-2">
              <div>
                <span className="block text-3xl font-semibold leading-none tracking-tight text-white">
                  Nike
                </span>
                <span className="block text-sm font-medium leading-tight text-primary-foreground/92">
                  gagne en visibilité
                </span>
              </div>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
                <ArrowUpRight className="h-4 w-4" />
              </div>
            </div>

            <div className="relative z-10">
              <div className="text-2xl font-bold tracking-tight text-white">
                {activePeriod.mentionRate}
              </div>
              <p className="text-xs font-medium text-primary-foreground/78">
                de mention rate
              </p>
            </div>

            <div className="relative z-10 mt-3 flex items-center gap-2">
              <span className="flex min-h-7 items-center rounded-[10px] bg-white/20 px-2 py-1 text-[10px] font-bold text-white">
                <TrendingUp className="mr-1 h-3 w-3" />
                {activePeriod.trend}
              </span>
              <span className="text-xs font-medium text-primary-foreground/72">
                {activePeriod.label}
              </span>
            </div>

            <div className="relative z-10 mt-3 flex h-9 items-end gap-1.5">
              {[18, 26, 20, 32, 30, 38, 34].map((height, index) => (
                <div
                  key={`trend-${index}`}
                  className={cn(
                    "flex-1 rounded-full bg-white/20",
                    index === 6 && "bg-white/80",
                  )}
                  style={{ height }}
                />
              ))}
            </div>
          </section>

          <div className="space-y-5">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 text-sm font-semibold text-foreground">
                <SectionTitleReplica>Filtres</SectionTitleReplica>
              </h4>
              <button
                type="button"
                onClick={onResetFilters}
                className="h-6 min-w-[7.5rem] rounded-md px-2 text-xs text-muted-foreground"
              >
                Réinitialiser
              </button>
            </div>

            <div className="space-y-1.5">
              <div className="text-xs text-muted-foreground">Période</div>
              <div className="grid grid-cols-3 gap-1 rounded-md border border-input bg-background p-1 shadow-xs">
                {periodOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => onPeriodChange(option.value)}
                    className={cn(
                      "rounded-sm px-2 py-1.5 text-xs font-medium transition-colors",
                      period === option.value
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {option.shortLabel}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <div className="text-xs text-muted-foreground">Modèles</div>
                <button
                  type="button"
                  onClick={onClearModels}
                  className="h-6 px-2 text-xs text-muted-foreground"
                >
                  Effacer
                </button>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {models.map((model) => (
                  <button
                    key={model.name}
                    type="button"
                    onClick={() => onModelToggle(model.id)}
                    className={cn(
                      "relative flex min-h-[86px] w-full min-w-0 flex-col items-start gap-2 rounded-lg border px-3 py-3 text-left transition-all",
                      selectedModelIds.includes(model.id)
                        ? "border-transparent bg-primary/[0.045]"
                        : "border-border/80 bg-card",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute right-2.5 top-2.5 flex h-3.5 w-3.5 items-center justify-center rounded-md border-[1.5px]",
                        selectedModelIds.includes(model.id)
                          ? "border-primary bg-primary/80"
                          : "border-border bg-background/70",
                      )}
                    />
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/60 bg-background/75 p-1.5">
                      <img
                        src={model.icon}
                        alt={model.group}
                        className="h-full w-full object-contain opacity-85"
                      />
                    </span>
                    <span className="line-clamp-1 text-sm font-semibold leading-tight text-foreground">
                      {model.group}
                    </span>
                    <span className="line-clamp-1 text-[11px] text-muted-foreground">
                      {model.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="h-px bg-border" />

          <div className="space-y-2">
            <div className="flex items-start justify-between gap-2">
              <h4 className="min-w-0 text-sm font-semibold leading-tight text-foreground">
                <SectionTitleReplica>Top concurrents</SectionTitleReplica>
              </h4>
            </div>
            <div className="space-y-2">
              {competitors.map((competitor) => (
                <label
                  key={competitor.name}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border border-dashed px-3 py-2",
                    selectedCompetitorIds.includes(competitor.id)
                      ? "border-primary bg-primary/5"
                      : "border-border/60",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={selectedCompetitorIds.includes(competitor.id)}
                    onChange={() => onCompetitorToggle(competitor.id)}
                    className="sr-only"
                  />
                  <span
                    className={cn(
                      "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border",
                      selectedCompetitorIds.includes(competitor.id)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background",
                    )}
                  >
                    {selectedCompetitorIds.includes(competitor.id) ? (
                      <Check className="h-3 w-3" />
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-tight">
                    {competitor.name}
                  </span>
                  <span className="text-[11px] tabular-nums text-muted-foreground">
                    {competitor.value}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type AnalyticsColumnReplicaProps = {
  period: PeriodValue;
  selectedModelIds: ModelId[];
  selectedCompetitorIds: CompetitorId[];
  brandMetric: BrandMetric;
  onBrandMetricChange: (value: BrandMetric) => void;
};

function AnalyticsColumnReplica({
  period,
  selectedModelIds,
  selectedCompetitorIds,
  brandMetric,
  onBrandMetricChange,
}: AnalyticsColumnReplicaProps) {
  const activePeriod =
    periodOptions.find((option) => option.value === period) ?? periodOptions[1];
  const filteredVisibilityBars =
    selectedModelIds.length > 0
      ? visibilityBars.filter((bar) => selectedModelIds.includes(bar.id))
      : visibilityBars;
  const displayedBrandRows = brandRows.filter(
    (row) =>
      row.id === "nike" ||
      selectedCompetitorIds.length === 0 ||
      selectedCompetitorIds.includes(row.id as CompetitorId),
  );
  const maxBrandValue = Math.max(
    1,
    ...displayedBrandRows.map((row) =>
      brandMetric === "sov" ? row.sov : row.mention,
    ),
  );
  const activeKpis = kpis.map((kpi) =>
    kpi.title === "Mention rate"
      ? { ...kpi, value: activePeriod.mentionRate, trend: activePeriod.trend }
      : kpi,
  );

  return (
    <div className="h-full min-h-0 overflow-y-auto px-1 no-scrollbar">
      <div className="flex flex-col gap-4 pb-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {activeKpis.map((kpi) => (
            <KpiCardReplica key={kpi.title} {...kpi} />
          ))}
        </div>

        <div className="rounded-md bg-card p-4">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">
                <SectionTitleReplica>Visibilité par modèle</SectionTitleReplica>
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Score pondéré sur les réponses IA du projet.
              </p>
            </div>
            <span className="rounded-md bg-muted/50 px-2 py-1 text-xs uppercase text-muted-foreground">
              {activePeriod.shortLabel}
            </span>
          </div>
          <div className="space-y-3">
            {filteredVisibilityBars.map((bar) => (
              <div key={bar.label} className="grid grid-cols-[86px_1fr_24px] items-center gap-3">
                <span className="text-xs text-muted-foreground">{bar.label}</span>
                <div className="h-7 overflow-hidden rounded-r-[5px] bg-muted">
                  <div className={cn("h-full rounded-r-[5px]", bar.color)} style={{ width: `${bar.value}%` }} />
                </div>
                <span className="text-xs font-medium tabular-nums">{bar.value}</span>
              </div>
            ))}
            {filteredVisibilityBars.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                Sélectionnez un modèle IA.
              </div>
            ) : null}
          </div>
        </div>

        <div className="overflow-hidden rounded-md bg-card">
          <div className="flex items-start justify-between gap-3 p-4 pb-2">
            <div className="space-y-1">
              <h3 className="text-base font-semibold">
                <SectionTitleReplica>Visibilité marque</SectionTitleReplica>
              </h3>
              <p className="text-xs leading-relaxed text-muted-foreground">
                Parts de voix citées par les assistants.
              </p>
            </div>
            <div className="flex rounded-md bg-muted p-1 text-[11px] font-medium">
              {[
                { value: "sov", label: "SOV %" },
                { value: "mention", label: "Mention" },
              ].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => onBrandMetricChange(item.value as BrandMetric)}
                  className={cn(
                    "rounded-sm px-2 py-1 transition-colors",
                    brandMetric === item.value
                      ? "bg-background text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_190px]">
            <div className="flex h-[190px] items-end gap-5 px-5 pb-5 pt-3">
              {displayedBrandRows.map((row) => {
                const value = brandMetric === "sov" ? row.sov : row.mention;
                const height = `${Math.max(18, Math.round((value / maxBrandValue) * 100))}%`;

                return (
                <div key={row.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-[128px] w-full items-end rounded-md bg-muted/60 p-1">
                    <div className={cn("w-full rounded-md", row.color)} style={{ height }} />
                  </div>
                  <span className="max-w-[72px] truncate text-[11px] text-muted-foreground">
                    {row.label}
                  </span>
                </div>
                );
              })}
            </div>
            <div className="border-t border-border/60 p-4 md:border-l md:border-t-0">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                Top brands
              </p>
              <div className="mt-3 space-y-3">
                {displayedBrandRows.map((row) => {
                  const value = brandMetric === "sov" ? row.sov : row.mention;
                  const width = `${Math.max(12, Math.round((value / maxBrandValue) * 100))}%`;

                  return (
                    <div key={row.label} className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-medium">{row.label}</span>
                        <span className="text-xs font-semibold">{value}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div className={cn("h-full rounded-full", row.color)} style={{ width }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-md bg-card p-4">
            <h3 className="text-base font-semibold">
              <SectionTitleReplica>Sentiment IA</SectionTitleReplica>
            </h3>
            <div className="mt-4 flex items-center justify-center">
              <div className="relative h-28 w-28 rounded-full bg-[conic-gradient(var(--primary)_0_58%,#8db7ff_58%_84%,#ef4444_84%_100%)]">
                <div className="absolute inset-5 rounded-full bg-card" />
                <div className="absolute inset-0 flex items-center justify-center text-lg font-bold">
                  72%
                </div>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {["Positif", "Neutre", "Négatif"].map((label, index) => (
                <div key={label} className="rounded-md border p-2 text-center">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="text-xs font-semibold">{[58, 26, 16][index]}%</div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-md bg-card p-4">
            <h3 className="text-base font-semibold">
              <SectionTitleReplica>Pages citées</SectionTitleReplica>
            </h3>
            <div className="mt-4 space-y-3">
              {[
                ["/features/monitoring", 74],
                ["/blog/ai-search", 58],
                ["/pricing", 36],
              ].map(([url, value]) => (
                <div key={url} className="space-y-1.5">
                  <span className="block truncate text-xs font-medium">{url}</span>
                  <div className="flex items-center gap-3 rounded-full bg-muted p-2">
                    <div className="h-3.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${value}%` }} />
                    </div>
                    <span className="min-w-8 text-right text-xs font-semibold text-muted-foreground">
                      {value}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type ActivityColumnReplicaProps = {
  selectedModelIds: ModelId[];
};

function ActivityColumnReplica({
  selectedModelIds,
}: ActivityColumnReplicaProps) {
  const filteredPrompts =
    selectedModelIds.length > 0
      ? prompts.filter((prompt) => selectedModelIds.includes(prompt.modelId))
      : prompts;
  const alerts = [
    ["critical", "Adidas dépasse Nike sur 8 prompts liés au marathon."],
    ["warning", "La visibilité Claude recule de 6 points depuis hier."],
    ["warning", "3 nouvelles pages concurrentes citent Puma et New Balance."],
  ] as const;

  return (
    <div className="h-full min-h-0 overflow-y-auto px-1 no-scrollbar">
      <div className="flex flex-col gap-6 pb-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <h4 className="min-w-0 text-sm font-semibold">
                <SectionTitleReplica>Alertes</SectionTitleReplica>
              </h4>
            </div>
            <span className="h-6 rounded-md bg-primary/10 px-2 font-mono text-xs leading-6 text-primary">
              {alerts.length}
            </span>
          </div>

          <div className="space-y-3">
            {alerts.map(([type, message]) => (
              <button
                key={message}
                type="button"
                className="group relative w-full overflow-hidden rounded-md bg-white p-3 text-left transition-all"
              >
                <div className="mb-1 flex items-start justify-between">
                  <span
                    className={cn(
                      "text-xs font-bold uppercase tracking-wider",
                      type === "critical" ? "text-destructive" : "text-amber-700",
                    )}
                  >
                    {type}
                  </span>
                  <span className="text-xs text-muted-foreground">2 prompts</span>
                </div>
                <p className="mb-2 text-xs font-medium leading-snug text-foreground">
                  {message}
                </p>
              </button>
            ))}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-semibold">
              <SectionTitleReplica>Flux prompts</SectionTitleReplica>
            </h4>
            <span className="h-6 rounded-md bg-primary/10 px-2 font-mono text-xs leading-6 text-primary">
              {filteredPrompts.length}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col space-y-3">
            {filteredPrompts.map((prompt) => (
              <button
                key={`${prompt.model}-${prompt.time}`}
                type="button"
                className="group w-full cursor-pointer rounded-md bg-white p-4 text-left transition-all"
              >
                <div className="mb-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="rounded-md border border-border/50 bg-white p-1">
                      <img
                        src={prompt.icon}
                        alt={prompt.model}
                        className="h-3.5 w-3.5 object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold capitalize text-foreground">
                        {prompt.model}
                      </p>
                      <p className="truncate text-[11px] lowercase text-muted-foreground">
                        {prompt.name}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs text-muted-foreground">
                    {prompt.time}
                  </span>
                </div>

                <p className="mb-3 line-clamp-3 text-xs font-medium leading-relaxed text-foreground/90">
                  &quot;{prompt.text}&quot;
                </p>

                <div className="flex items-center justify-between border-t border-border/40 pt-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn(
                        "rounded-sm text-xs font-semibold",
                        prompt.status === "Mentionné"
                          ? "text-emerald-600"
                          : "text-destructive",
                      )}
                    >
                      {prompt.status}
                    </span>
                    {prompt.rank ? (
                      <>
                        <div className="h-[12px] w-px bg-border" />
                        <span className="text-xs font-bold text-primary">
                          {prompt.rank}
                        </span>
                      </>
                    ) : null}
                  </div>
                  <span
                    className={cn(
                      "flex h-6 items-center rounded-sm px-2 text-xs font-bold",
                      prompt.score > 80
                        ? "bg-green-500/10 text-green-700"
                        : prompt.score > 60
                          ? "bg-amber-500/10 text-amber-700"
                          : "bg-destructive/10 text-destructive",
                    )}
                  >
                    {prompt.score}
                  </span>
                </div>
              </button>
            ))}
            {filteredPrompts.length === 0 ? (
              <div className="rounded-md border border-dashed bg-white p-4 text-center text-xs text-muted-foreground">
                Aucun prompt pour les modèles sélectionnés.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LinearMonitoringPreview() {
  const [period, setPeriod] = useState<PeriodValue>("30d");
  const [selectedModelIds, setSelectedModelIds] = useState<ModelId[]>([
    "openai",
    "anthropic",
  ]);
  const [selectedCompetitorIds, setSelectedCompetitorIds] = useState<CompetitorId[]>([
    "adidas",
  ]);
  const [brandMetric, setBrandMetric] = useState<BrandMetric>("sov");

  const toggleModel = (modelId: ModelId) => {
    setSelectedModelIds((current) =>
      current.includes(modelId)
        ? current.filter((item) => item !== modelId)
        : [...current, modelId],
    );
  };

  const toggleCompetitor = (competitorId: CompetitorId) => {
    setSelectedCompetitorIds((current) =>
      current.includes(competitorId)
        ? current.filter((item) => item !== competitorId)
        : [...current, competitorId],
    );
  };

  const resetFilters = () => {
    setPeriod("30d");
    setSelectedModelIds(["openai", "anthropic"]);
    setSelectedCompetitorIds(["adidas"]);
    setBrandMetric("sov");
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-muted/30 px-3 pb-6 pt-3">
      <div className="grid h-full min-h-0 grid-cols-1 gap-3 xl:grid-cols-12">
        <div className="h-full min-h-0 overflow-hidden xl:col-span-3">
          <FilterColumnReplica
            period={period}
            selectedModelIds={selectedModelIds}
            selectedCompetitorIds={selectedCompetitorIds}
            onPeriodChange={setPeriod}
            onModelToggle={toggleModel}
            onClearModels={() => setSelectedModelIds([])}
            onCompetitorToggle={toggleCompetitor}
            onResetFilters={resetFilters}
          />
        </div>
        <div className="h-full min-h-0 overflow-hidden xl:col-span-6">
          <AnalyticsColumnReplica
            period={period}
            selectedModelIds={selectedModelIds}
            selectedCompetitorIds={selectedCompetitorIds}
            brandMetric={brandMetric}
            onBrandMetricChange={setBrandMetric}
          />
        </div>
        <div className="h-full min-h-0 overflow-hidden xl:col-span-3">
          <ActivityColumnReplica
            selectedModelIds={selectedModelIds}
          />
        </div>
      </div>
    </div>
  );
}

function LinearAppSidebarReplica() {
  return (
    <aside className="flex h-auto max-h-[360px] min-h-0 w-full min-w-0 flex-col overflow-hidden border-b border-border bg-primary lg:h-full lg:max-h-none lg:min-h-[520px] lg:w-[220px] lg:min-w-[220px] lg:border-b-0 lg:border-r">
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border/40 px-3">
          <span className="ml-2 truncate text-sm font-semibold text-background">
            <img src="/logos/logo_white.svg" alt="Logo" className="h-10" />
          </span>
        </div>

        <div className="shrink-0 border-b border-border/40 px-3 py-4">
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-md bg-background/10 px-2 py-1.5 transition-colors hover:bg-background/20"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-100 to-blue-200">
              <span className="text-[10px] font-semibold text-primary">NK</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <div className="truncate text-sm font-medium text-background">
                Nike
              </div>
            </div>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-background" />
          </button>
        </div>

        <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4 lg:py-6">
          <div className="space-y-3">
            {sidebarNavSections.map((section, index) => (
              <section
                key={section.title ?? `sidebar-section-${index}`}
                className="space-y-2 pb-2"
              >
                {section.title ? (
                  <div className="px-2 pb-1 text-xs font-bold uppercase tracking-[0.04em] text-white/55">
                    {section.title}
                  </div>
                ) : null}

                <div className="relative space-y-1.5">
                  {section.indent ? (
                    <div className="absolute bottom-1 left-[11px] top-1 w-[2px] rounded-full bg-white/22" />
                  ) : null}
                  {section.items.map((item) => (
                    <LinearSidebarNavItem
                      key={item.label}
                      label={item.label}
                      active={item.active}
                      indent={section.indent}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        </nav>
      </div>

      <div className="shrink-0 border-t border-background/40 p-2">
        <div className="mb-2 px-1">
          <div className="w-full rounded-lg px-2 py-2">
            <div className="space-y-1.5">
              <div className="h-1.5 overflow-hidden rounded-full bg-background/20">
                <div className="h-full w-[38%] rounded-full bg-background/40" />
              </div>
              <div className="truncate text-xs font-medium text-background/80">
                182 / 500 credits
              </div>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

export default function LinearHeroCard({
  children,
  title = "Faster app launch",
  eyebrow = "ENG-2703",
  className = "",
}: LinearHeroCardProps) {
  return (
    <>
      <div className="relative mx-auto flex min-h-screen max-w-[1400px] items-center px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <motion.div
          initial={{ opacity: 0, y: 24, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "relative mx-auto flex h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl border border-border bg-background backdrop-blur-xl sm:rounded-2xl lg:h-[760px] lg:max-h-[85vh]",
            className,
          )}
        >
       <div className="px-6 py-4 border-b border-foreground/10 flex items-center justify-between">
                <span className="text-sm font-mono text-primary uppercase tracking-widest">sc</span>
                <span className="flex items-center gap-2 text-xs font-mono text-green-600">
                  <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                 sc
                </span>
              </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[220px_minmax(0,1fr)]">
            <LinearAppSidebarReplica />
            <div className="min-h-0 min-w-0">{children}</div>
          </div>

        </motion.div>
      </div>
    </>
  );
}
