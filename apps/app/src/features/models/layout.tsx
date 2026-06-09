"use client";

import { ModelsPanel } from "./_components/models-panel";

type ModelsLayoutProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function ModelsLayout({ apiBaseURL, routeSearch }: ModelsLayoutProps) {
  return <ModelsPanel apiBaseURL={apiBaseURL} routeSearch={routeSearch} />;
}
