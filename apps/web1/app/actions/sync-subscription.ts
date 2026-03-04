"use server";

import { apiFetch } from "@/lib/server-api";
import { apiRoutes } from "@/lib/api-config";
import { revalidatePath } from "next/cache";

export async function syncSubscription() {
    try {
        const res = await apiFetch(apiRoutes.billing.ensureSynced(), {
            method: "POST",
        });

        revalidatePath("/", "layout");

        return { ok: true, data: res };
    } catch (e) {
        console.error("[SyncSubscription] Failed:", e);
        return { ok: false, error: "Failed to sync subscription" };
    }
}
