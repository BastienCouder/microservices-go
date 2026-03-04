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
const CONSENT_VERSION = "v1.0";

/**
 * GDPR Cookie Banner Component
 * 
 * Displays a cookie consent banner on first visit.
 * Stores preferences in cookies and syncs with backend.
 */
export function CookieBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [showDetails, setShowDetails] = useState(false);
    const [preferences, setPreferences] = useState<ConsentPreferences>({
        necessary: true,
        analytics: false,
        marketing: false,
        thirdParty: false,
    });

    useEffect(() => {
        // Check if consent was already given
        const existingConsent = Cookies.get(CONSENT_COOKIE_NAME);
        if (!existingConsent) {
            setIsVisible(true);
        }
    }, []);

    const saveConsent = async (prefs: ConsentPreferences) => {
        // Save to cookie
        Cookies.set(CONSENT_COOKIE_NAME, JSON.stringify({
            ...prefs,
            version: CONSENT_VERSION,
            timestamp: new Date().toISOString(),
        }), {
            expires: 365,
            sameSite: "lax",
            secure: process.env.NODE_ENV === "production",
        });

        setIsVisible(false);
    };

    const acceptAll = () => {
        const allAccepted = {
            necessary: true,
            analytics: true,
            marketing: true,
            thirdParty: true,
        };
        saveConsent(allAccepted);
    };

    const acceptNecessary = () => {
        const onlyNecessary = {
            necessary: true,
            analytics: false,
            marketing: false,
            thirdParty: false,
        };
        saveConsent(onlyNecessary);
    };

    const saveCustom = () => {
        saveConsent(preferences);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-black/90 text-white backdrop-blur-sm border-t border-white/10">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                    <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">🍪 Nous respectons votre vie privée</h3>
                        <p className="text-sm text-white/70">
                            Nous utilisons des cookies pour améliorer votre expérience.
                            Vous pouvez personnaliser vos préférences ci-dessous.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={acceptNecessary}
                            className="px-4 py-2 text-sm border border-white/30 rounded hover:bg-white/10 transition"
                        >
                            Refuser optionnels
                        </button>
                        <button
                            onClick={() => setShowDetails(!showDetails)}
                            className="px-4 py-2 text-sm border border-white/30 rounded hover:bg-white/10 transition"
                        >
                            Personnaliser
                        </button>
                        <button
                            onClick={acceptAll}
                            className="px-4 py-2 text-sm bg-white text-black rounded font-medium hover:bg-white/90 transition"
                        >
                            Tout accepter
                        </button>
                    </div>
                </div>

                {showDetails && (
                    <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <ConsentToggle
                            label="Essentiels"
                            description="Nécessaires au fonctionnement du site"
                            checked={true}
                            disabled
                        />
                        <ConsentToggle
                            label="Analytiques"
                            description="Nous aident à améliorer le site"
                            checked={preferences.analytics}
                            onChange={(v) => setPreferences(p => ({ ...p, analytics: v }))}
                        />
                        <ConsentToggle
                            label="Marketing"
                            description="Personnalisation des publicités"
                            checked={preferences.marketing}
                            onChange={(v) => setPreferences(p => ({ ...p, marketing: v }))}
                        />
                        <ConsentToggle
                            label="Tiers"
                            description="Partage avec nos partenaires"
                            checked={preferences.thirdParty}
                            onChange={(v) => setPreferences(p => ({ ...p, thirdParty: v }))}
                        />
                        <div className="md:col-span-2 lg:col-span-4 flex justify-end">
                            <button
                                onClick={saveCustom}
                                className="px-4 py-2 text-sm bg-white text-black rounded font-medium hover:bg-white/90 transition"
                            >
                                Sauvegarder mes préférences
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function ConsentToggle({
    label,
    description,
    checked,
    onChange,
    disabled
}: {
    label: string;
    description: string;
    checked: boolean;
    onChange?: (v: boolean) => void;
    disabled?: boolean;
}) {
    return (
        <label className={`flex items-start gap-3 p-3 rounded border border-white/10 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-white/5'}`}>
            <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onChange?.(e.target.checked)}
                disabled={disabled}
                className="mt-1 w-4 h-4 accent-white"
            />
            <div>
                <div className="font-medium text-sm">{label}</div>
                <div className="text-xs text-white/50">{description}</div>
            </div>
        </label>
    );
}
