import { redirect } from "next/navigation";
import { toQueryString, type PageSearchParams } from "@/src/auth/search-params";

type AuthLoginAliasPageProps = {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
};

export default async function AuthLoginAliasPage({ searchParams }: AuthLoginAliasPageProps) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  redirect(`/login${toQueryString(resolvedSearchParams)}`);
}
