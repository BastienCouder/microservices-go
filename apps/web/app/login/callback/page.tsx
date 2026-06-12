import { redirect } from "next/navigation";
import { normalizeAppReturnTo } from "@/src/auth/routing";
import { pickFirst, type PageSearchParams } from "@/src/auth/search-params";

export const dynamic = "force-dynamic";

type AuthCallbackPageProps = {
  searchParams?: Promise<PageSearchParams> | PageSearchParams;
};

function getAppURL(): string {
  const appURL = process.env.NEXT_PUBLIC_APP_URL;
  if (typeof appURL === "string" && appURL.trim() !== "") {
    return appURL.trim();
  }

  return "http://localhost:30004";
}

export default async function AuthCallbackPage({ searchParams }: AuthCallbackPageProps) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const returnTo = normalizeAppReturnTo(pickFirst(resolvedSearchParams?.return_to), getAppURL());
  redirect(returnTo);
}
