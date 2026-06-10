import path from "node:path";
import { fileURLToPath } from "node:url";

import * as grpc from "@grpc/grpc-js";
import * as protoLoader from "@grpc/proto-loader";

import { signInternalJWT } from "./auth.js";
import type {
  DueAnalysisJob,
  ExecutePromptResult,
  RecordResponseResult,
  SchedulerClients,
  SchedulerConfig,
  ScheduledAnalysisJobDefinition,
  StartAnalysisResult,
} from "./types.js";

interface ProtoPromptText {
  id: string;
  text: string;
}

interface ProtoPromptRunRef {
  id: string;
  promptId: string;
  promptText: string;
}

interface ProtoPromptSchedule {
  mode: string;
  cron: string;
  timezone: string;
  modelCrons?: Record<string, string>;
}

interface ProtoScheduledAnalysisJob {
  projectId: string;
  projectName: string;
  organizationId: number;
  createdBy: number;
  brandName: string;
  competitors: string[];
  promptId: string;
  promptText: string;
  modelIds: string[];
  providerCredentials?: Record<string, ProtoModelProviderCredential>;
  schedule?: ProtoPromptSchedule;
}

interface ProtoModelProviderCredential {
  providerId: string;
  providerModelId: string;
  providerApiKey: string;
}

interface ListScheduledAnalysisJobsResponse {
  jobs: ProtoScheduledAnalysisJob[];
}

interface StartAnalysisRequest {
  requestId: string;
  userId: number;
  projectId: string;
  promptTexts: ProtoPromptText[];
  modelIds: string[];
  runType: string;
}

interface ProtoAnalysisRunRef {
  id: string;
}

interface ProtoStartAnalysisResponse {
  analysisRun?: ProtoAnalysisRunRef;
  promptRuns: ProtoPromptRunRef[];
}

interface RecordResponseRequest {
  runId: string;
  promptRunId: string;
  modelId: string;
  rawResponse: string;
  brandMentioned: boolean;
  brandPosition: string;
  citationFound: boolean;
  citedUrls: string[];
  sentiment: string;
}

interface ProtoRecordResponseResponse {
  recorded: boolean;
}

interface ExecutePromptRequest {
  promptId: string;
  promptText: string;
  modelId: string;
  providerId: string;
  providerApiKey: string;
  brandName: string;
  competitors: string[];
}

interface ProtoPromptExecutionAnalysis {
  brandMentioned: boolean;
  brandPosition: string;
  citationFound: boolean;
  citedUrls: string[];
  sentiment: string;
}

interface ProtoExecutePromptResponse {
  rawResponse: string;
  analysis?: ProtoPromptExecutionAnalysis;
  tokensUsed: number;
  latencyMs: number;
}

type UnaryCallback<T> = (error: grpc.ServiceError | null, response: T) => void;

interface ProjectServiceClient extends grpc.Client {
  listScheduledAnalysisJobs(
    request: Record<string, never>,
    metadata: grpc.Metadata,
    callback: UnaryCallback<ListScheduledAnalysisJobsResponse>,
  ): grpc.ClientUnaryCall;
}

interface AnalysisServiceClient extends grpc.Client {
  startAnalysis(
    request: StartAnalysisRequest,
    metadata: grpc.Metadata,
    callback: UnaryCallback<ProtoStartAnalysisResponse>,
  ): grpc.ClientUnaryCall;
  recordResponse(
    request: RecordResponseRequest,
    metadata: grpc.Metadata,
    callback: UnaryCallback<ProtoRecordResponseResponse>,
  ): grpc.ClientUnaryCall;
}

interface IAServiceClient extends grpc.Client {
  executePrompt(
    request: ExecutePromptRequest,
    metadata: grpc.Metadata,
    callback: UnaryCallback<ProtoExecutePromptResponse>,
  ): grpc.ClientUnaryCall;
}

type ClientConstructor<TClient extends grpc.Client> = new (
  address: string,
  credentials: grpc.ChannelCredentials,
  options?: Partial<grpc.ChannelOptions>,
) => TClient;

interface LoadedProtoPackages {
  project: {
    v1: {
      ProjectService: ClientConstructor<ProjectServiceClient>;
    };
  };
  analysis: {
    v1: {
      AnalysisService: ClientConstructor<AnalysisServiceClient>;
    };
  };
  ia: {
    v1: {
      IAService: ClientConstructor<IAServiceClient>;
    };
  };
}

interface GRPCTransport {
  credentials: grpc.ChannelCredentials;
  channelOptions: Partial<grpc.ChannelOptions>;
}

export class SchedulerServiceError extends Error {
  code: number | undefined;

  constructor(message: string, code?: number) {
    super(message);
    this.name = "SchedulerServiceError";
    this.code = code;
  }
}

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const PROTO_ROOT = path.resolve(CURRENT_DIR, "../proto");
const PROTO_LOADER_OPTIONS: protoLoader.Options = {
  keepCase: false,
  longs: Number,
  enums: String,
  defaults: true,
  arrays: true,
  objects: true,
  oneofs: true,
};

function loadConstructors(): LoadedProtoPackages {
  const packageDefinition = protoLoader.loadSync(
    [
      path.join(PROTO_ROOT, "project/v1/project.proto"),
      path.join(PROTO_ROOT, "analysis/v1/analysis.proto"),
      path.join(PROTO_ROOT, "ia/v1/ia.proto"),
    ],
    PROTO_LOADER_OPTIONS,
  );

  return grpc.loadPackageDefinition(packageDefinition) as unknown as LoadedProtoPackages;
}

export function createGRPCTransport(config: SchedulerConfig): GRPCTransport {
  if (config.grpcAllowInsecure) {
    return {
      credentials: grpc.credentials.createInsecure(),
      channelOptions: {},
    };
  }

  const hasClientCert = config.grpcTLSCert !== "";
  const hasClientKey = config.grpcTLSKey !== "";
  if (hasClientCert !== hasClientKey) {
    throw new Error("GRPC_TLS_CERT and GRPC_TLS_KEY must be provided together");
  }

  const channelOptions: Partial<grpc.ChannelOptions> = {};
  if (config.grpcTLSServerName !== "") {
    channelOptions["grpc.ssl_target_name_override"] = config.grpcTLSServerName;
    channelOptions["grpc.default_authority"] = config.grpcTLSServerName;
  }

  return {
    credentials: grpc.credentials.createSsl(
      config.grpcTLSCA === "" ? undefined : Buffer.from(config.grpcTLSCA, "utf8"),
      hasClientKey ? Buffer.from(config.grpcTLSKey, "utf8") : undefined,
      hasClientCert ? Buffer.from(config.grpcTLSCert, "utf8") : undefined,
    ),
    channelOptions,
  };
}

function issueToken(
  config: SchedulerConfig,
  {
    audience,
    organizationId = 0,
    userId = 0,
  }: {
    audience: string;
    organizationId?: number;
    userId?: number;
  },
): string {
  return signInternalJWT({
    secret: config.internalJWTSecret,
    issuer: config.internalJWTIssuer,
    audience,
    subject: config.internalJWTSubject,
    organizationId,
    userId,
  });
}

function metadataWithBearer(token: string): grpc.Metadata {
  const metadata = new grpc.Metadata();
  metadata.set("authorization", `Bearer ${token}`);
  return metadata;
}

function grpcErrorMessage(error: grpc.ServiceError): string {
  return error.details || error.message;
}

function unaryCall<TResponse>(
  invoke: (callback: UnaryCallback<TResponse>) => grpc.ClientUnaryCall,
): Promise<TResponse> {
  return new Promise<TResponse>((resolve, reject) => {
    invoke((error, response) => {
      if (error !== null) {
        reject(new SchedulerServiceError(grpcErrorMessage(error), error.code));
        return;
      }
      resolve(response);
    });
  });
}

export function isQuotaExceededSchedulerError(error: unknown): boolean {
  return error instanceof SchedulerServiceError && error.code === grpc.status.RESOURCE_EXHAUSTED;
}

function toScheduledAnalysisJobDefinitions(
  response: ListScheduledAnalysisJobsResponse,
): ScheduledAnalysisJobDefinition[] {
  return response.jobs.map((job) => {
    const providerCredentials =
      job.providerCredentials !== undefined
        ? { ...job.providerCredentials }
        : undefined;

    return {
      projectId: job.projectId,
      projectName: job.projectName,
      organizationId: job.organizationId,
      createdBy: job.createdBy,
      brandName: job.brandName,
      competitors: [...job.competitors],
      promptId: job.promptId,
      promptText: job.promptText,
      modelIds: [...job.modelIds],
      ...(providerCredentials !== undefined ? { providerCredentials } : {}),
      schedule: {
        mode: job.schedule?.mode ?? "",
        cron: job.schedule?.cron ?? "",
        timezone: job.schedule?.timezone ?? "",
        ...(job.schedule?.modelCrons !== undefined ? { modelCrons: job.schedule.modelCrons } : {}),
      },
    };
  });
}

export function createClients(config: SchedulerConfig): SchedulerClients {
  const constructors = loadConstructors();
  const transport = createGRPCTransport(config);

  const projectClient = new constructors.project.v1.ProjectService(
    config.projectServiceGRPCAddr,
    transport.credentials,
    transport.channelOptions,
  );
  const analysisClient = new constructors.analysis.v1.AnalysisService(
    config.analysisServiceGRPCAddr,
    transport.credentials,
    transport.channelOptions,
  );
  const iaClient = new constructors.ia.v1.IAService(
    config.iaServiceGRPCAddr,
    transport.credentials,
    transport.channelOptions,
  );

  return {
    close(): void {
      projectClient.close();
      analysisClient.close();
      iaClient.close();
    },
    project: {
      async listScheduledAnalysisJobs(): Promise<ScheduledAnalysisJobDefinition[]> {
        const token = issueToken(config, { audience: "project-service" });
        const response = await unaryCall<ListScheduledAnalysisJobsResponse>((callback) =>
          projectClient.listScheduledAnalysisJobs({}, metadataWithBearer(token), callback),
        );
        return toScheduledAnalysisJobDefinitions(response);
      },
    },
    analysis: {
      async startScheduledAnalysis(job: DueAnalysisJob): Promise<StartAnalysisResult> {
        const token = issueToken(config, {
          audience: "analysis-service",
          organizationId: job.organizationId,
          userId: job.createdBy,
        });
        const response = await unaryCall<ProtoStartAnalysisResponse>((callback) =>
          analysisClient.startAnalysis(
            {
              requestId: job.requestId,
              userId: job.createdBy,
              projectId: job.projectId,
              promptTexts: [{ id: job.promptId, text: job.promptText }],
              modelIds: [job.modelId],
              runType: "scheduled",
            },
            metadataWithBearer(token),
            callback,
          ),
        );

        return {
          analysisRun: {
            id: response.analysisRun?.id ?? "",
          },
          promptRuns: response.promptRuns.map((promptRun) => ({
            id: promptRun.id,
            promptId: promptRun.promptId,
            promptText: promptRun.promptText,
          })),
        };
      },
      async recordResponse(
        job: DueAnalysisJob,
        runId: string,
        promptRunId: string,
        iaResult: ExecutePromptResult,
      ): Promise<RecordResponseResult> {
        const token = issueToken(config, {
          audience: "analysis-service",
          organizationId: job.organizationId,
          userId: job.createdBy,
        });
        const response = await unaryCall<ProtoRecordResponseResponse>((callback) =>
          analysisClient.recordResponse(
            {
              runId,
              promptRunId,
              modelId: job.modelId,
              rawResponse: iaResult.rawResponse,
              brandMentioned: iaResult.analysis.brandMentioned,
              brandPosition: iaResult.analysis.brandPosition,
              citationFound: iaResult.analysis.citationFound,
              citedUrls: iaResult.analysis.citedUrls,
              sentiment: iaResult.analysis.sentiment,
            },
            metadataWithBearer(token),
            callback,
          ),
        );
        return { recorded: response.recorded };
      },
    },
    ia: {
      async executePrompt(job: DueAnalysisJob): Promise<ExecutePromptResult> {
        const token = issueToken(config, { audience: "ia-service" });
        const providerCredential = job.providerCredentials?.[job.modelId];
        const response = await unaryCall<ProtoExecutePromptResponse>((callback) =>
          iaClient.executePrompt(
            {
              promptId: job.promptId,
              promptText: job.promptText,
              modelId: providerCredential?.providerModelId || job.modelId,
              providerId: providerCredential?.providerId || "",
              providerApiKey: providerCredential?.providerApiKey || "",
              brandName: job.brandName || job.projectName,
              competitors: job.competitors,
            },
            metadataWithBearer(token),
            callback,
          ),
        );

        return {
          promptId: job.promptId,
          modelId: job.modelId,
          rawResponse: response.rawResponse,
          rawMetadata: {
            tokensUsed: response.tokensUsed,
            latencyMs: response.latencyMs,
          },
          analysis: {
            brandMentioned: response.analysis?.brandMentioned ?? false,
            brandPosition: response.analysis?.brandPosition ?? "",
            citationFound: response.analysis?.citationFound ?? false,
            citedUrls: response.analysis?.citedUrls ?? [],
            sentiment: response.analysis?.sentiment ?? "",
          },
        };
      },
    },
  };
}
