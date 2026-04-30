import type { UserProfile } from "@/shared/models";

export type AccountProfileViewData = {
  email: string;
  firstName: string;
  lastName: string;
};

export function buildAccountProfileViewData(user: UserProfile): AccountProfileViewData {
  return {
    email: user.Email || "-",
    firstName: user.FirstName || "",
    lastName: user.LastName || "",
  };
}
