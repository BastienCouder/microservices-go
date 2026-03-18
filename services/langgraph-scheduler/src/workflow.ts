import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

import type {
  DueAnalysisJob,
  ExecutePromptResult,
  PromptRunRef,
  SchedulerClients,
  StartAnalysisResult,
} from "./types.js";

const WorkflowState = Annotation.Root({
  job: Annotation<DueAnalysisJob>({
    reducer: (_current, update) => update,
  }),
  startResult: Annotation<StartAnalysisResult | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  promptRun: Annotation<PromptRunRef | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
  iaResult: Annotation<ExecutePromptResult | null>({
    reducer: (_current, update) => update,
    default: () => null,
  }),
});

type ScheduledWorkflowState = typeof WorkflowState.State;
type ScheduledWorkflowUpdate = typeof WorkflowState.Update;

function requireStateValue<T>(value: T | null, label: string): T {
  if (value === null) {
    throw new Error(`Scheduled workflow is missing ${label}`);
  }
  return value;
}

export function createScheduledRunWorkflow(clients: SchedulerClients) {
  const startAnalysis = async (
    state: ScheduledWorkflowState,
  ): Promise<ScheduledWorkflowUpdate> => {
    const startResult = await clients.analysis.startScheduledAnalysis(state.job);
    const promptRun =
      startResult.promptRuns.find((item) => item.promptId === state.job.promptId) ??
      startResult.promptRuns[0];

    if (startResult.analysisRun.id === "") {
      throw new Error("Scheduled run did not return an analysis run id");
    }
    if (promptRun === undefined) {
      throw new Error("Scheduled run did not return a prompt run id");
    }

    return {
      startResult,
      promptRun,
    };
  };

  const executePrompt = async (
    state: ScheduledWorkflowState,
  ): Promise<ScheduledWorkflowUpdate> => {
    const iaResult = await clients.ia.executePrompt(state.job);
    return { iaResult };
  };

  const recordResponse = async (
    state: ScheduledWorkflowState,
  ): Promise<ScheduledWorkflowUpdate> => {
    const startResult = requireStateValue(state.startResult, "startResult");
    const promptRun = requireStateValue(state.promptRun, "promptRun");
    const iaResult = requireStateValue(state.iaResult, "iaResult");

    await clients.analysis.recordResponse(state.job, startResult.analysisRun.id, promptRun.id, iaResult);
    return {};
  };

  return new StateGraph(WorkflowState)
    .addNode("startAnalysis", startAnalysis)
    .addNode("executePrompt", executePrompt)
    .addNode("recordResponse", recordResponse)
    .addEdge(START, "startAnalysis")
    .addEdge("startAnalysis", "executePrompt")
    .addEdge("executePrompt", "recordResponse")
    .addEdge("recordResponse", END)
    .compile();
}
