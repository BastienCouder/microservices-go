import type {
  MonitoringData,
  MonitoringModel as MonitoringModelData,
  MonitoringPrompt as MonitoringPromptData,
} from "../shared/monitoring-data";

export type FilterModelItem = {
  id: string;
  displayName: string;
  groupName: string;
  description: string;
  iconPath: string;
  live: boolean;
  memberIds: string[];
};

export type FilterModelCard = {
  id: string;
  name: string;
  description: string;
  icon: string;
  live: boolean;
  modelGroup: string;
};

export type PersonaOption = {
  id: string;
  label: string;
};

export type MonitoringProject = MonitoringData["project"];
export type MonitoringModel = MonitoringModelData;
export type MonitoringPrompt = MonitoringPromptData;
