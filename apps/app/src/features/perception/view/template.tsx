import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { perceptionViewContent } from "../core";

export function PerceptionTemplate() {
  return <FeatureViewShell {...perceptionViewContent} />;
}
