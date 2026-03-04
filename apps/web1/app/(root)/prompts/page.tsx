import { PromptsClient } from "./prompts-client";
import { getDashboardDataServer } from "@/lib/dashboard-data-server";
import { resolveServerRuntimeContext } from "@/lib/runtime-server";

export default async function PromptsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const context = resolveServerRuntimeContext(params);
  const initialData = await getDashboardDataServer(context);

  return (
    <PromptsClient
      initialData={initialData}
      initialMode={context.mode}
      initialProjectId={context.projectId}
    />
  );
}
