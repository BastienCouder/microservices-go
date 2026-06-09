import type { UserProfile } from "@/shared/models";
import { AccountLayout } from "./layout";
import { useAccountProfileViewModel } from "./_lib/profile/use-account-profile-view-model";

type AccountPageProps = {
  apiBaseURL: string;
  busy: boolean;
  user: UserProfile | null;
  onLogout?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
};

export function AccountPage(props: AccountPageProps) {
  const viewModel = useAccountProfileViewModel(props);

  return <AccountLayout {...viewModel} />;
}
