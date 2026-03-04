import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { pagesViewContent } from "../core";

export function PagesTemplate() {
  return <FeatureViewShell {...pagesViewContent} />;
}
