import { redirect } from "next/navigation";

export default function OrganizationCreatePage() {
  redirect("/organizations?tab=organizations");
}
