import { FeatureViewShell } from "@/features/shared/view/feature-view-shell";
import { settingsViewContent } from "../core";

export function SettingsTemplate() {
  return <FeatureViewShell {...settingsViewContent} />;
}
