import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";
import AccountClient from "./account-client";
import { redirect } from "next/navigation"
import type { ProfileMe } from "@/types/profile";

export default async function AccountPage() {

  async function getProfileFromServer() {
    try {
      const profile = await apiFetch<ProfileMe>(apiRoutes.profiles.me());
      return profile;
    } catch (error) {
      console.error("Failed to fetch profile on server:", error);
      return null;
    }
  }

  const profile = await getProfileFromServer();
  if (!profile) redirect("/auth");

  return <AccountClient profile={profile} />;
}