"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";

interface ConsentPreferences {
    necessary: boolean;
    analytics: boolean;
    marketing: boolean;
    thirdParty: boolean;
}

const CONSENT_COOKIE_NAME = "gdpr_consent";

/**
 * Hook to get and update GDPR consent preferences
 */
export function useConsent() {
    const [consent, setConsent] = useState<ConsentPreferences | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const storedConsent = Cookies.get(CONSENT_COOKIE_NAME);
        if (storedConsent) {
            try {
                const parsed = JSON.parse(storedConsent);
                setConsent({
                    necessary: true,
                    analytics: parsed.analytics ?? false,
                    marketing: parsed.marketing ?? false,
                    thirdParty: parsed.thirdParty ?? false,
                });
            } catch {
                setConsent(null);
            }
        }
        setIsLoading(false);
    }, []);

    const updateConsent = async (newPrefs: Partial<ConsentPreferences>) => {
        const updated = {
            necessary: true,
            analytics: newPrefs.analytics ?? consent?.analytics ?? false,
            marketing: newPrefs.marketing ?? consent?.marketing ?? false,
            thirdParty: newPrefs.thirdParty ?? consent?.thirdParty ?? false,
        };

        // Update cookie
        Cookies.set(CONSENT_COOKIE_NAME, JSON.stringify({
            ...updated,
            version: "v1.0",
            timestamp: new Date().toISOString(),
        }), {
            expires: 365,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        setConsent(updated);

        // TODO: Sync with backend when profile exists
        // await apiFetch("/profiles/me/consent", {
        //     method: "PUT",
        //     body: JSON.stringify(updated),
        // });

        return updated;
    };

    const revokeAll = () => {
        return updateConsent({
            analytics: false,
            marketing: false,
            thirdParty: false,
        });
    };

    const hasConsent = (type: keyof ConsentPreferences) => {
        return consent?.[type] ?? false;
    };

    return {
        consent,
        isLoading,
        hasConsent,
        updateConsent,
        revokeAll,
    };
}
