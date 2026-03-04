export type PeriodKey = "today" | "7d" | "14d" | "30d" | "90d" | "custom";
export type Stage = "Awareness" | "Consideration" | "Decision";
export type Persona = string;
export type AIModel = string;
export type PromptSort = "mention" | "rank" | "sov";
export type ResponseView = "table" | "timeline";

export type PromptRun = {
  id: string;
  time: string;
  model: AIModel;
  minutesAgo: number;
  mention: boolean;
  rank: number | null;
  competitor: string;
  score: number;
  error: string | null;
  critical: boolean;
  response: string;
  highlights: string[];
};

export type PromptItem = {
  id: string;
  prompt: string;
  type: string;
  stage: Stage;
  persona: Persona;
  models: AIModel[];
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
  persona: Persona;
  models: AIModel[];
};

export type ModelVisual = {
  icon: string;
  description: string;
  label: string;
};
