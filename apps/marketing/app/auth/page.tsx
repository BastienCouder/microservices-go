import { redirect } from "next/navigation";

type AuthRedirectPageProps = {
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

export default async function AuthRedirectPage({ searchParams }: AuthRedirectPageProps) {
  const resolvedSearchParams = searchParams instanceof Promise ? await searchParams : searchParams;
  const params = new URLSearchParams();
  const returnTo = pickFirst(resolvedSearchParams?.return_to);
  const error = pickFirst(resolvedSearchParams?.error);

  if (returnTo) {
    params.set("return_to", returnTo);
  }

  if (error) {
    params.set("error", error);
  }

  redirect(`/login${params.toString() ? `?${params.toString()}` : ""}`);
}
