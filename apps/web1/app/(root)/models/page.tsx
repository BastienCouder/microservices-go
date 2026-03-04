import { getDashboardDataServer } from "@/lib/dashboard-data-server";
import { resolveServerRuntimeContext } from "@/lib/runtime-server";
import { ModelsClient } from "./models-client";

export default async function ModelsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const context = resolveServerRuntimeContext(params);
  const initialData = await getDashboardDataServer(context);

  return (
    <ModelsClient
      initialData={initialData}
      initialMode={context.mode}
      initialProjectId={context.projectId}
    />
  );
}
