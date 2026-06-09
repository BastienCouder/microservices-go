import { ConfirmDialog } from "@/components/shared/confirm-dialog";
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
  return (
    <ConfirmDialog
      open={member !== null}
      onOpenChange={onOpenChange}
      title="Retirer ce membre ?"
      description="Le membre perdra l'acces a cette organisation. Ses roles seront retires."
      confirmLabel="Retirer"
      loading={memberActionBusy}
      onConfirm={onConfirm}
    />
  );
}
