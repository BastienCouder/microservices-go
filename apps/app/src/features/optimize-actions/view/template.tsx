import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { optimizeActionsViewContent } from "../core";

export function OptimizeActionsTemplate() {
  return <FeatureViewShell {...optimizeActionsViewContent} />;
}
