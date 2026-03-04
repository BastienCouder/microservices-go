import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { promptsViewContent } from "../core";

export function PromptsTemplate() {
  return <FeatureViewShell {...promptsViewContent} />;
}
