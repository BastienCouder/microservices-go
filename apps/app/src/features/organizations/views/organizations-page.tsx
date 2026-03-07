import OrganizationsClient from "../organizations-client";
import type { UserProfile } from "@/shared/models";

type OrganizationsPageProps = {
  apiBaseURL: string;
  busy: boolean;
  routeSearch: string;
  user: UserProfile | null;
};

export function OrganizationsPage({ apiBaseURL, busy, routeSearch, user }: OrganizationsPageProps) {
  return <OrganizationsClient apiBaseURL={apiBaseURL} busy={busy} routeSearch={routeSearch} user={user} />;
}
