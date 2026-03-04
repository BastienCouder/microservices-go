import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { modelsViewContent } from "../core";

export function ModelsTemplate() {
  return <FeatureViewShell {...modelsViewContent} />;
}
