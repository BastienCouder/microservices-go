"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function logout() {
    const cookieStore = await cookies();
    cookieStore.delete("better-auth.session_token");
    cookieStore.delete("better-auth.session_data");

    redirect("/auth");
}
