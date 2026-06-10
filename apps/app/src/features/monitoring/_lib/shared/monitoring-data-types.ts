import type { DateRange } from "react-day-picker";

import type { ProjectModelMeta } from "@/lib/project-models";
import type { RuntimeMode } from "@/lib/runtime-mode";

export type MonitoringCompetitor = {
  name: string;
  website: string;
  initials: string;
  sov: number;
  trend: "up" | "down" | "stable";
};

export type MonitoringModel = ProjectModelMeta;

export type MonitoringPrompt = {
  responseId: string;
  promptId: string;
  modelId: string;
  modelGroupName: string;
  modelDisplayName: string;
  modelProviderModelId: string;
  modelIconPath: string;
  text: string;
  persona: string;
  competitorsMentioned: string[];
  mention: boolean;
  sentiment: "positive" | "neutral" | "negative";
  citationFound: boolean;
  citedUrls: string[];
  allCitedUrls: string[];
  rank?: number;
  score: number;
  time: string;
  createdAt?: string;
  response: string;
};

export type MonitoringAlert = {
  type: string;
  prompts: string;
  msg: string;
  time: string;
  isRead: boolean;
  createdAt?: string;
  modelIds?: string[];
  personas?: string[];
  competitors?: string[];
};

export type MonitoringData = {
  project: {
    id: string;
    name: string;
    website?: string;
    tagline: string;
    personas: string[];
    competitors: MonitoringCompetitor[];
  };
  models: MonitoringModel[];
  recent_prompts: MonitoringPrompt[];
  alerts: MonitoringAlert[];
  kpis: {
    mention_rate: { value: string; trend: string };
    visibility_score: { value: string; trend: string };
    avg_position: { value: string; trend: string };
  };
  trends: {
    mention_rate: number;
    visibility_score: number;
    avg_position: number;
  };
  pagesStats: {
    pages: Array<{ pageUrl: string; citationShare: number }>;
  };
};

export type MonitoringLoadResult = {
  data: MonitoringData;
  projectId: string | null;
  mode: RuntimeMode;
};

export type MonitoringQueryContext = {
  projectId: string | null;
  mode: RuntimeMode;
};

export type MonitoringLoadFilters = {
  period: string;
  dateRange: DateRange | undefined;
  selectedModels: string[];
  selectedPersonas: string[];
  selectedCompetitors: string[];
};

export type MonitoringRequestScope =
  | "projects"
  | "project"
  | "models"
  | "competitors"
  | "monitoring";

export class MonitoringRequestError extends Error {
  scope: MonitoringRequestScope;
  status: number;

  constructor(scope: MonitoringRequestScope, status: number, message?: string) {
    super(message || `monitoring request failed: ${scope}`);
    this.name = "MonitoringRequestError";
    this.scope = scope;
    this.status = status;
  }
}

export function createEmptyMonitoringData(): MonitoringData {
  return {
    project: {
      id: "",
      name: "",
      website: "",
      tagline: "",
      personas: [],
      competitors: [],
    },
    models: [],
    recent_prompts: [],
    alerts: [],
    kpis: {
      mention_rate: { value: "0%", trend: "+0 vs 7j" },
      visibility_score: { value: "0 / 100", trend: "+0 vs 7j" },
      avg_position: { value: "0", trend: "+0 (meilleure position)" },
    },
    trends: {
      mention_rate: 0,
      visibility_score: 0,
      avg_position: 0,
    },
    pagesStats: {
      pages: [],
    },
  };
}
