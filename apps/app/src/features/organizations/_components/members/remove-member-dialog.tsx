import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useScopedI18n } from "@/shared/hooks/use-i18n";
import type { OrganizationMember } from "../../_lib/shared/types";

export function RemoveMemberDialog({
  member,
  memberActionBusy,
  onOpenChange,
  onConfirm,
}: {
  member: OrganizationMember | null;
  memberActionBusy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const { t } = useScopedI18n("organizations");

  return (
    <ConfirmDialog
      open={member !== null}
      onOpenChange={onOpenChange}
      title={t("removeMemberTitle")}
      description={t("removeMemberConfirmDescription")}
      confirmLabel={t("remove")}
      loading={memberActionBusy}
      onConfirm={onConfirm}
    />
  );
}
