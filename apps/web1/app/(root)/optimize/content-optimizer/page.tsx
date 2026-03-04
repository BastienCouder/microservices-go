import { getOptimizePageData } from "@/lib/optimize-page-data";
import { OptimizePageClient } from "../optimize-client";

export default async function OptimizeContentOptimizerPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const data = await getOptimizePageData(searchParams);
  return <OptimizePageClient {...data} pageMode="content-optimizer" />;
}

