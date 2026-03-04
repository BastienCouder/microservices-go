import { getPerceptionDataServer } from "@/lib/perception-data";
import { resolveServerRuntimeContext } from "@/lib/runtime-server";
import { BrandCanonEditorPageClient } from "./page-client";

export default async function PerceptionBrandCanonPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const context = resolveServerRuntimeContext(params);
  const initialData = await getPerceptionDataServer(context);

  return <BrandCanonEditorPageClient initialData={initialData} />;
}
