import { redirect } from "next/navigation";

export default async function OptimizePage({
  searchParams: _searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  void _searchParams;
  redirect("/optimize/actions");
}
