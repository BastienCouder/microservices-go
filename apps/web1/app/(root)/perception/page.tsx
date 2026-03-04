import { resolveServerRuntimeContext } from "@/lib/runtime-server";
import { getPerceptionDataServer } from "@/lib/perception-data";
import { PerceptionClient } from "./perception-client";

export default async function PerceptionPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const context = resolveServerRuntimeContext(params);
  const initialData = await getPerceptionDataServer(context);

  return <PerceptionClient initialData={initialData} />;
}
