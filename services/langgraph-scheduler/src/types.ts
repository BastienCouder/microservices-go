export interface SchedulerConfig {
  projectServiceGRPCAddr: string;
  analysisServiceGRPCAddr: string;
  iaServiceGRPCAddr: string;
  internalJWTSecret: string;
  internalJWTIssuer: string;
  internalJWTSubject: string;
  grpcAllowInsecure: boolean;
  grpcTLSCA: string;
  grpcTLSCert: string;
  grpcTLSKey: string;
  grpcTLSServerName: string;
  pollIntervalMs: number;
  lookbackMinutes: number;
  recentRunTTLms: number;
}

export interface PromptSchedule {
  mode: string;
  cron: string;
  timezone: string;
  modelCrons?: Record<string, string>;
}

export interface ScheduledAnalysisJobDefinition {
  projectId: string;
  projectName: string;
  organizationId: number;
  createdBy: number;
  brandName: string;
  competitors: string[];
  promptId: string;
  promptText: string;
  modelIds: string[];
  providerCredentials?: Record<string, ModelProviderCredential>;
  schedule: PromptSchedule;
}

export interface ModelProviderCredential {
  providerId: string;
  providerModelId: string;
  providerApiKey: string;
}

export interface DueAnalysisJob extends Omit<ScheduledAnalysisJobDefinition, "modelIds"> {
  modelId: string;
  requestId: string;
  slotKey: string;
  cronExpression: string;
  timeZone: string;
}

export interface AnalysisRunRef {
  id: string;
}

export interface PromptRunRef {
  id: string;
  promptId: string;
  promptText: string;
}

export interface StartAnalysisResult {
  analysisRun: AnalysisRunRef;
  promptRuns: PromptRunRef[];
}

export interface PromptExecutionMetadata {
  tokensUsed: number;
  latencyMs: number;
}

export interface PromptExecutionAnalysis {
  brandMentioned: boolean;
  brandPosition: string;
  citationFound: boolean;
  citedUrls: string[];
  sentiment: string;
}

export interface ExecutePromptResult {
  promptId: string;
  modelId: string;
  rawResponse: string;
  rawMetadata: PromptExecutionMetadata;
  analysis: PromptExecutionAnalysis;
}

export interface RecordResponseResult {
  recorded: boolean;
}

export interface SchedulerClients {
  close(): void;
  project: {
    listScheduledAnalysisJobs(): Promise<ScheduledAnalysisJobDefinition[]>;
  };
  analysis: {
    startScheduledAnalysis(job: DueAnalysisJob): Promise<StartAnalysisResult>;
    recordResponse(
      job: DueAnalysisJob,
      runId: string,
      promptRunId: string,
      iaResult: ExecutePromptResult,
    ): Promise<RecordResponseResult>;
  };
  ia: {
    executePrompt(job: DueAnalysisJob): Promise<ExecutePromptResult>;
  };
}
