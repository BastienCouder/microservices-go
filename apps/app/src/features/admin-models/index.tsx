import { AdminModelsTemplate } from "./view/template";

type AdminModelsPageProps = {
  apiBaseURL: string;
  routeSearch: string;
};

export function AdminModelsPage({
  apiBaseURL,
  routeSearch,
}: AdminModelsPageProps) {
  return (
    <AdminModelsTemplate apiBaseURL={apiBaseURL} routeSearch={routeSearch} />
  );
}
