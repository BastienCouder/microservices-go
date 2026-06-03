import type { OptimizePriority } from "./shared/perception-data";

export function getPerceptionPriorityTone(priority: OptimizePriority) {
  if (priority === "high") return "border-transparent bg-destructive/10 text-destructive";
  if (priority === "medium") return "border-transparent bg-amber-500/10 text-amber-700";
  return "border-transparent bg-green-500/10 text-green-700";
}

export function getPerceptionActionStatusTone(status: string | undefined) {
  if (status === "done") return "border-green-500/30 bg-green-500/10 text-green-700";
  if (status === "processing") return "border-blue-500/30 bg-blue-500/10 text-blue-700";
  return "border-border bg-muted/50 text-muted-foreground";
}
