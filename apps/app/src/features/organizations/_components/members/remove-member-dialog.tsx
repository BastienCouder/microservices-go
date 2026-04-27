import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
    <AlertDialog open={member !== null} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Retirer ce membre ?</AlertDialogTitle>
          <AlertDialogDescription>
            Le membre perdra l'acces a cette organisation. Ses roles seront retires.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={onConfirm}
            disabled={memberActionBusy}
          >
            Retirer
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
