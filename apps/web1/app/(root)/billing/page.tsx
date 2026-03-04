import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";
import BillingClient from "./billing-client";
import { redirect } from "next/navigation";
import { ProfileMe } from "@/types/profile";

export default async function BillingPage() {

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
  // if (!profile) redirect("/auth"); // Resilience: Don't redirect, show billing options anyway

  return <BillingClient profile={profile} />;
}