import { SettingsTemplate } from "./template";

type SettingsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function SettingsPage({ apiBaseURL, routeSearch }: SettingsPageProps) {
  return <SettingsTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
