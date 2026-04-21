import { getMostRecentDueSlot, resolveModelCron } from "./cron.js";
import { loadConfig } from "./config.js";
import { createClients, isQuotaExceededSchedulerError } from "./grpc.js";
import type {
  DueAnalysisJob,
  SchedulerClients,
  SchedulerConfig,
  ScheduledAnalysisJobDefinition,
} from "./types.js";
import { createScheduledRunWorkflow } from "./workflow.js";

function log(event: string, payload: Record<string, unknown> = {}): void {
  const entry = {
    event,
    ts: new Date().toISOString(),
    ...payload,
  };
  console.log(JSON.stringify(entry));
}

function sanitizeSegment(value: string | number): string {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "-");
}

function buildRequestId(
  job: ScheduledAnalysisJobDefinition,
  modelId: string,
  slotKey: string,
  timeZone: string,
): string {
  return [
    "scheduled",
    sanitizeSegment(job.projectId),
    sanitizeSegment(job.promptId),
    sanitizeSegment(modelId),
    sanitizeSegment(timeZone),
    slotKey,
  ].join(":");
}

function expandDueJobs(
  jobDefinitions: ScheduledAnalysisJobDefinition[],
  now: Date,
  lookbackMinutes: number,
): DueAnalysisJob[] {
  const dueJobs: DueAnalysisJob[] = [];

  for (const definition of jobDefinitions) {
    for (const modelId of definition.modelIds) {
      const cronExpression = resolveModelCron(definition.schedule, modelId);
      const timeZone = definition.schedule.timezone || "UTC";
      let slot: ReturnType<typeof getMostRecentDueSlot>;
      try {
        slot = getMostRecentDueSlot({
          cronExpression,
          timeZone,
          now,
          lookbackMinutes,
        });
      } catch (error) {
        log("scheduler.invalid_timezone", {
          projectId: definition.projectId,
          promptId: definition.promptId,
          timeZone,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      if (slot === null) {
        continue;
      }

      dueJobs.push({
        projectId: definition.projectId,
        projectName: definition.projectName,
        organizationId: definition.organizationId,
        createdBy: definition.createdBy,
        brandName: definition.brandName,
        competitors: definition.competitors,
        promptId: definition.promptId,
        promptText: definition.promptText,
        schedule: definition.schedule,
        modelId,
        requestId: buildRequestId(definition, modelId, slot.slotKey, timeZone),
        slotKey: slot.slotKey,
        cronExpression,
        timeZone,
      });
    }
  }

  dueJobs.sort((left, right) => left.requestId.localeCompare(right.requestId));
  return dueJobs;
}

function pruneRecentRuns(recentRuns: Map<string, number>, ttlMs: number): void {
  const cutoff = Date.now() - ttlMs;
  for (const [requestId, timestamp] of recentRuns.entries()) {
    if (timestamp < cutoff) {
      recentRuns.delete(requestId);
    }
  }
}

function currentQuotaMonthKey(now: Date): string {
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

function pruneQuotaBlocks(blockedOrganizations: Map<number, string>, monthKey: string): void {
  for (const [organizationId, blockedMonthKey] of blockedOrganizations.entries()) {
    if (blockedMonthKey !== monthKey) {
      blockedOrganizations.delete(organizationId);
    }
  }
}

async function runCycle(
  config: SchedulerConfig,
  clients: SchedulerClients,
  workflow: ReturnType<typeof createScheduledRunWorkflow>,
  recentRuns: Map<string, number>,
  blockedOrganizations: Map<number, string>,
): Promise<void> {
  pruneRecentRuns(recentRuns, config.recentRunTTLms);
  const monthKey = currentQuotaMonthKey(new Date());
  pruneQuotaBlocks(blockedOrganizations, monthKey);

  const jobDefinitions = await clients.project.listScheduledAnalysisJobs();
  const dueJobs = expandDueJobs(jobDefinitions, new Date(), config.lookbackMinutes);

  if (dueJobs.length === 0) {
    log("scheduler.idle");
    return;
  }

  log("scheduler.due_jobs_found", { count: dueJobs.length });

  for (const job of dueJobs) {
    if (blockedOrganizations.get(job.organizationId) === monthKey) {
      continue;
    }
    if (recentRuns.has(job.requestId)) {
      continue;
    }

    recentRuns.set(job.requestId, Date.now());
    log("scheduler.job_start", {
      requestId: job.requestId,
      projectId: job.projectId,
      promptId: job.promptId,
      modelId: job.modelId,
      slotKey: job.slotKey,
    });

    try {
      await workflow.invoke({ job });
      log("scheduler.job_complete", {
        requestId: job.requestId,
        projectId: job.projectId,
        promptId: job.promptId,
        modelId: job.modelId,
      });
    } catch (error) {
      if (isQuotaExceededSchedulerError(error)) {
        blockedOrganizations.set(job.organizationId, monthKey);
        log("scheduler.job_skipped_quota", {
          requestId: job.requestId,
          organizationId: job.organizationId,
          projectId: job.projectId,
          promptId: job.promptId,
          modelId: job.modelId,
          monthKey,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      recentRuns.delete(job.requestId);
      log("scheduler.job_failed", {
        requestId: job.requestId,
        projectId: job.projectId,
        promptId: job.promptId,
        modelId: job.modelId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig();
  const clients = createClients(config);
  const workflow = createScheduledRunWorkflow(clients);
  const recentRuns = new Map<string, number>();
  const blockedOrganizations = new Map<number, string>();

  log("scheduler.started", {
    pollIntervalMs: config.pollIntervalMs,
    lookbackMinutes: config.lookbackMinutes,
  });

  let shuttingDown = false;
  const handleShutdown = (signal: NodeJS.Signals): void => {
    if (!shuttingDown) {
      shuttingDown = true;
      log("scheduler.stopping", { signal });
    }
  };

  process.on("SIGINT", () => handleShutdown("SIGINT"));
  process.on("SIGTERM", () => handleShutdown("SIGTERM"));

  try {
    while (!shuttingDown) {
      try {
        await runCycle(config, clients, workflow, recentRuns, blockedOrganizations);
      } catch (error) {
        log("scheduler.cycle_failed", {
          error: error instanceof Error ? error.message : String(error),
        });
      }

      if (shuttingDown) {
        break;
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, config.pollIntervalMs);
      });
    }
  } finally {
    clients.close();
  }
}

main().catch((error: unknown) => {
  log("scheduler.fatal", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
