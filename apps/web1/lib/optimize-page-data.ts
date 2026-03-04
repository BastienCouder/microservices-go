import { buildDemoContentOptimizerSummary, getContentOptimizerSummaryServer } from "@/lib/content-optimizer-data";
import { buildDemoOptimizeActions, getOptimizeActionsServer } from "@/lib/optimize-data";
import { getPerceptionDataServer } from "@/lib/perception-data";
import { resolveServerRuntimeContext } from "@/lib/runtime-server";

export async function getOptimizePageData(searchParams: Promise<{ [key: string]: string | string[] | undefined }>) {
  const params = await searchParams;
  const context = resolveServerRuntimeContext(params);
  const perceptionData = await getPerceptionDataServer(context);

  let contentOptimizerSummary = buildDemoContentOptimizerSummary(perceptionData.brandCanon);
  let initialActions = buildDemoOptimizeActions(perceptionData);

  if (perceptionData.metadata.projectId) {
    try {
      initialActions = await getOptimizeActionsServer(perceptionData.metadata.projectId);
    } catch {
      // Fallback to seeded data if optimize endpoint is unavailable.
    }
    try {
      contentOptimizerSummary = await getContentOptimizerSummaryServer(perceptionData.metadata.projectId);
    } catch {
      // Fallback mock content optimizer.
    }
  }

  return {
    initialActions,
    brandCanon: perceptionData.brandCanon,
    projectId: perceptionData.metadata.projectId ?? null,
    source: perceptionData.source,
    brandName: perceptionData.brandCanon.brandName,
    contentOptimizerSummary,
  };
}

