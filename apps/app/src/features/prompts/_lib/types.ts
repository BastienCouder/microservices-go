export type PeriodKey = "today" | "7d" | "14d" | "30d" | "90d" | "custom";
export type Stage = "Awareness" | "Consideration" | "Decision";
export type Persona = string;
export type AIModel = string;
export type PromptSort =
  | "prompt"
  | "persona"
  | "ai"
  | "mention"
  | "rank"
  | "sov"
  | "lastRun"
  | "status";
export type PromptSortDirection = "asc" | "desc";
export type ResponseView = "table" | "timeline";
export type PromptRowMode = "global" | "model";
export type PromptScheduleMode = "global" | "per_model";

export type PromptSchedule = {
  mode: PromptScheduleMode;
  cron: string;
  timezone: string;
  modelCrons: Record<string, string>;
};

export type PromptRun = {
  id: string;
  time: string;
  model: AIModel;
  isHistorical?: boolean;
  minutesAgo: number;
  mention: boolean;
  rank: number | null;
  competitor: string;
  competitors: string[];
  score: number;
  error: string | null;
  critical: boolean;
  response: string;
  highlights: string[];
};

export type PromptItem = {
  id: string;
  sourcePromptId: string;
  rowMode: PromptRowMode;
  prompt: string;
  type?: string | null;
  stage: Stage;
  persona?: Persona | null;
  models: AIModel[];
  schedule: PromptSchedule;
  effectiveCron: string;
  effectiveScheduleLabel: string;
  effectiveScheduleSource: "global" | "override";
  mentionRate: number;
  rank: number;
  sov: number;
  lastRunMinutes: number;
  trend30d: number[];
  runs: PromptRun[];
  status: "active" | "disabled" | "archived";
};

export type PromptRunRow = PromptRun & {
  promptId: string;
  prompt: string;
  stage: Stage;
  persona?: Persona | null;
  models: AIModel[];
  isHistorical: boolean;
};

export type ModelVisual = {
  icon: string;
  description: string;
  label: string;
  provider: string;
  name: string;
};

export type ProjectPromptRecord = {
  id: string;
  text: string;
  intent?: string;
  modelIds?: string[];
  schedule?: PromptSchedule;
  status?: PromptItem["status"];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type PromptPageResult = {
  items: ProjectPromptRecord[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

export type PromptEditorMode = "create" | "edit";

export type SavePromptEditorInput = {
  mode: PromptEditorMode;
  promptId?: string;
  text: string;
  modelIds: AIModel[];
  schedule: PromptSchedule;
  status: PromptItem["status"];
};
