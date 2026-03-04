import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { brandsViewContent } from "../core";

export function BrandsTemplate() {
  return <FeatureViewShell {...brandsViewContent} />;
}
