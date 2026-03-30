import { redirect } from "next/navigation";
import { normalizeAppReturnTo } from "@/src/auth/routing";

export const dynamic = "force-dynamic";

type AuthCallbackPageProps = {
  searchParams?:
    | Promise<Record<string, string | string[] | undefined>>
    | Record<string, string | string[] | undefined>;
};

function pickFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

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
