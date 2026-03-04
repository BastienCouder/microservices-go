import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { impactViewContent } from "../core";

export function ImpactTemplate() {
  return <FeatureViewShell {...impactViewContent} />;
}
