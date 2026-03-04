"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Cookies from "js-cookie";

export function ReferralTracker() {
    const searchParams = useSearchParams();

    useEffect(() => {
        const ref = searchParams.get("ref");
        // Validate format: nanoid 10 chars (alphanumeric, dash, underscore only)
        if (ref && /^[a-zA-Z0-9_-]{10}$/.test(ref)) {
            // Store referral code in cookies for 30 days
            Cookies.set("referral_code", ref, {
                expires: 30,
                sameSite: "lax", // CSRF protection
                secure: process.env.NODE_ENV === "production", // HTTPS only in prod
            });
            console.log("[ReferralTracker] Referral code stored:", ref);
        } else if (ref) {
            console.warn("[ReferralTracker] Invalid referral code format:", ref);
        }
    }, [searchParams]);

    return null;
}
