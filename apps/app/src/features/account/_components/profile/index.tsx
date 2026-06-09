import { useEffect, useMemo, useState } from "react";
import { LogOut, Save, Trash2 } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { SectionTitle } from "@/components/shared/section-title";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type { AccountProfileViewData } from "../../_lib/profile/account-profile-view-data";
import type { AccountProfileUpdateInput } from "../../_lib/profile/use-account-profile-view-model";

type AccountProfilePanelProps = {
  busy: boolean;
  profile: AccountProfileViewData | null;
  onLogout?: () => Promise<void>;
  onRefresh?: () => Promise<void>;
  onDeleteAccount: () => void;
  onUpdateProfile: (input: AccountProfileUpdateInput) => void;
};

function getInitials(firstName: string, lastName: string, email: string): string {
  const initials = [firstName, lastName]
    .map((value) => value.trim().charAt(0))
    .filter(Boolean)
    .join("");
  return (initials || email.trim().charAt(0) || "?").toUpperCase();
}

export function AccountProfilePanel({
  busy,
  profile,
  onLogout,
  onRefresh,
  onDeleteAccount,
  onUpdateProfile,
}: AccountProfilePanelProps) {
  const { t } = useScopedI18n("account");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  useEffect(() => {
    setFirstName(profile?.firstName ?? "");
    setLastName(profile?.lastName ?? "");
  }, [profile]);

  const initials = useMemo(
    () => getInitials(firstName, lastName, profile?.email ?? ""),
    [firstName, lastName, profile?.email],
  );
  const canSave =
    !!profile &&
    firstName.trim() !== "" &&
    lastName.trim() !== "" &&
    (firstName.trim() !== profile.firstName || lastName.trim() !== profile.lastName);

  if (!profile) {
    return (
      <section className="rounded-lg border border-border/60 bg-card p-4">
        <SectionTitle>{t("sessionTitle")}</SectionTitle>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("noSession")}
        </p>
      </section>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <SectionTitle showIndicator={false}>{t("profileTitle")}</SectionTitle>
        </div>
        <form
          className="grid gap-5 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSave) return;
            onUpdateProfile({ firstName: firstName.trim(), lastName: lastName.trim() });
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-lg font-semibold text-primary">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold">
                {[firstName, lastName].filter(Boolean).join(" ") || profile.email}
              </p>
              <p className="truncate text-sm text-muted-foreground">{profile.email}</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="account-first-name">{t("firstName")}</Label>
              <Input
                id="account-first-name"
                value={firstName}
                disabled={busy}
                onChange={(event) => setFirstName(event.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-last-name">{t("lastName")}</Label>
              <Input
                id="account-last-name"
                value={lastName}
                disabled={busy}
                onChange={(event) => setLastName(event.target.value)}
              />
            </div>
            <div className="grid gap-2 md:col-span-2">
              <Label htmlFor="account-email">{t("email")}</Label>
              <Input
                id="account-email"
                disabled
                value={profile.email}
                className="disabled:opacity-100"
              />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={busy || !canSave}>
              <Save data-icon="inline-start" />
              {t("save")}
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border/60 bg-card">
        <div className="border-b border-border/60 px-4 py-3">
          <SectionTitle showIndicator={false}>{t("sessionTitle")}</SectionTitle>
        </div>
        <div className="grid gap-3 p-4">
          <Button
            type="button"
            variant="outline"
            className="w-full justify-center text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={busy}
            onClick={() => void onLogout?.()}
          >
            <LogOut data-icon="inline-start" />
            {t("logout")}
          </Button>
          <ConfirmDialog
            trigger={
              <Button type="button" variant="destructive" className="w-full justify-center" disabled={busy}>
                <Trash2 data-icon="inline-start" />
                {t("deleteAccount")}
              </Button>
            }
            title={t("deleteAccountTitle")}
            description={t("deleteAccountDescription")}
            confirmLabel={t("delete")}
            loading={busy}
            media={<Trash2 />}
            onConfirm={() => onDeleteAccount()}
          />
        </div>
      </section>
    </div>
  );
}
