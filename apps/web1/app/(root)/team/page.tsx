import { redirect } from "next/navigation";

export default function TeamPage() {
  redirect("/organizations?tab=team");
}
