import { PageHeader } from "@/components/shared/page-header";
import { AccountProfilePanel } from "./_components/profile";
import type { AccountProfileViewData } from "./_lib/profile/account-profile-view-data";
import type { AccountProfileUpdateInput } from "./_lib/profile/use-account-profile-view-model";

type AccountLayoutProps = {
  busy: boolean;
  profile: AccountProfileViewData | null;
  onLogout?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onDeleteAccount: () => void;
  onUpdateProfile: (input: AccountProfileUpdateInput) => void;
};

export function AccountLayout({
  busy,
  profile,
  onLogout,
  onRefresh,
  onDeleteAccount,
  onUpdateProfile,
}: AccountLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden p-2 md:p-4">
      <PageHeader
        title="Compte utilisateur"
        baseline="Nom, prenom et email du compte connecte."
        actionsVariant="classic"
        className="hidden md:block"
      />
      <div className="min-h-0 flex-1 overflow-auto pr-1">
        <AccountProfilePanel
          busy={busy}
          profile={profile}
          onLogout={onLogout}
          onRefresh={onRefresh}
          onDeleteAccount={onDeleteAccount}
          onUpdateProfile={onUpdateProfile}
        />
      </div>
    </div>
  );
}
