import { getOptimizePageData } from "@/lib/optimize-page-data";
import { OptimizePageClient } from "../optimize-client";

export default async function OptimizeActionsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const data = await getOptimizePageData(searchParams);
  return <OptimizePageClient {...data} pageMode="actions" />;
}

