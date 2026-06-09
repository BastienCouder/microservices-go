import { redirect } from "next/navigation";
import { toQueryString, type PageSearchParams } from "@/src/auth/search-params";

type AuthRegisterAliasPageProps = {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
};

export default async function AuthRegisterAliasPage({ searchParams }: AuthRegisterAliasPageProps) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  redirect(`/register${toQueryString(resolvedSearchParams)}`);
}
