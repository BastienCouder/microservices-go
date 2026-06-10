import { type SimulatedPlan } from "@/shared/billing-plan";

const PROMPT_PLAN_LIMITS: Record<SimulatedPlan, number> = {
  starter: 100,
  developer: 500,
  growth: 250,
  pro: 500,
  "agency-enterprise": 5000,
};

export type PromptPlanUsageSummary = {
  usedPrompts: number;
  limit: number;
  remainingPrompts: number;
  progress: number;
  isLimitReached: boolean;
};

export function getPromptPlanLimit(plan: SimulatedPlan): number {
  return PROMPT_PLAN_LIMITS[plan];
}

export function buildPromptPlanUsageSummary({
  limit,
  usedPrompts,
}: {
  limit: number;
  usedPrompts: number;
}): PromptPlanUsageSummary {
  const normalizedLimit = Math.max(0, Math.floor(limit));
  const normalizedUsage = Math.max(0, Math.floor(usedPrompts));
  const remainingPrompts = Math.max(0, normalizedLimit - normalizedUsage);
  const progress =
    normalizedLimit > 0 ? Math.min(100, Math.round((normalizedUsage / normalizedLimit) * 100)) : 0;

  return {
    usedPrompts: normalizedUsage,
    limit: normalizedLimit,
    remainingPrompts,
    progress,
    isLimitReached: normalizedLimit > 0 && normalizedUsage >= normalizedLimit,
  };
}

export function buildSimulatedPromptPlanUsageSummary({
  plan,
  usedPrompts,
}: {
  plan: SimulatedPlan;
  usedPrompts: number;
}): PromptPlanUsageSummary {
  return buildPromptPlanUsageSummary({
    limit: getPromptPlanLimit(plan),
    usedPrompts,
  });
}

export function readPromptPlan(organizationId: string): SimulatedPlan {
  void organizationId;
  return "starter";
}
