export const PROMPTS_STREAM_BATCH_SIZE = 10;

export function getInitialVisiblePromptsCount(
  previewCount: number,
  totalCount: number,
): number {
  if (totalCount <= 0) {
    return 0;
  }

  const safePreviewCount = Number.isFinite(previewCount)
    ? Math.max(1, Math.floor(previewCount))
    : 1;

  return Math.min(safePreviewCount, totalCount);
}

export function getNextVisiblePromptsCount({
  currentCount,
  totalCount,
  batchSize = PROMPTS_STREAM_BATCH_SIZE,
}: {
  currentCount: number;
  totalCount: number;
  batchSize?: number;
}): number {
  if (totalCount <= 0) {
    return 0;
  }

  if (currentCount >= totalCount) {
    return totalCount;
  }

  return Math.min(totalCount, currentCount + Math.max(1, batchSize));
}
