import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { contentOptimizerViewContent } from "../core";

export function ContentOptimizerTemplate() {
  return <FeatureViewShell {...contentOptimizerViewContent} />;
}
