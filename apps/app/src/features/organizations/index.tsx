import { OrganizationsLayout } from "./layout";
import { useOrganizationsPageViewModel } from "./_lib/page/use-organizations-page-view-model";
import type { UserProfile } from "@/shared/models";

type OrganizationsPageProps = {
  apiBaseURL: string;
  busy: boolean;
  routeSearch: string;
  user: UserProfile | null;
};

export function OrganizationsPage(props: OrganizationsPageProps) {
  const viewModel = useOrganizationsPageViewModel(props);

  return <OrganizationsLayout {...viewModel} />;
}
