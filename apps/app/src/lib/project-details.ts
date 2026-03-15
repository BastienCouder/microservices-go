import { apiRoutes } from "@/lib/api-config";
import { gatewayJSON } from "@/shared/api/gateway";

export type ProjectWhiteLabelFrequency = "weekly" | "monthly" | "quarterly";
export type ProjectWhiteLabelTemplate = "executive" | "performance" | "board";
export type ProjectWhiteLabelLocale = "fr" | "en" | "es" | "de";

export type ProjectWhiteLabelBranding = {
  platformName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string;
  emailFromName: string;
  emailReplyTo: string;
  customDomain: string;
};

export type ProjectWhiteLabelReporting = {
  template: ProjectWhiteLabelTemplate;
  locale: ProjectWhiteLabelLocale;
  timezone: string;
  frequency: ProjectWhiteLabelFrequency;
  recipients: string[];
  liveShareEnabled: boolean;
  shareLinkTTLHours: number;
};

export type ProjectWhiteLabelSettings = {
  version: number;
  branding: ProjectWhiteLabelBranding;
  reporting: ProjectWhiteLabelReporting;
};

export type ProjectDetailsRecord = {
  id: string;
  name: string;
  status: string;
  domain: string;
  websiteUrl: string;
  brandName: string;
  brandDescription: string;
  attributionSource: string;
  industry: string;
  primaryLanguage: string;
  country: string;
  whiteLabel: ProjectWhiteLabelSettings;
  createdAt: string;
  updatedAt: string;
};

const DEFAULT_PRIMARY_COLOR = "#3b82f6";
const DEFAULT_SECONDARY_COLOR = "#dbeafe";
const DEFAULT_ACCENT_COLOR = "#0f172a";
const DEFAULT_FONT_FAMILY = "Manrope, Arial, Helvetica, sans-serif";
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_SHARE_TTL_HOURS = 168;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapSuccessEnvelope(value: unknown): unknown {
  if (!isRecord(value)) return value;
  if (value.success === true && "data" in value) {
    return value.data;
  }
  return value;
}

function getField<T = unknown>(value: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (key in value) {
      return value[key] as T;
    }
  }
  return undefined;
}

function getString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function getIDString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function getBoolean(value: unknown): boolean {
  return value === true;
}

function getNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const seen = new Set<string>();
  const items: string[] = [];
  value.forEach((entry) => {
    const item = getString(entry).toLowerCase();
    if (item === "" || seen.has(item)) return;
    seen.add(item);
    items.push(item);
  });
  return items;
}

function normalizeTemplate(value: string): ProjectWhiteLabelTemplate {
  if (value === "performance" || value === "board") return value;
  return "executive";
}

function normalizeFrequency(value: string): ProjectWhiteLabelFrequency {
  if (value === "weekly" || value === "quarterly") return value;
  return "monthly";
}

function normalizeLocale(value: string): ProjectWhiteLabelLocale {
  if (value === "en" || value === "es" || value === "de") return value;
  return "fr";
}

function normalizeShareTTL(value: number): number {
  if (value < 24) return DEFAULT_SHARE_TTL_HOURS;
  if (value > 24 * 30) return 24 * 30;
  return Math.round(value);
}

function firstNonEmpty(...values: string[]): string {
  return values.find((value) => value.trim() !== "")?.trim() || "";
}

export function buildDefaultWhiteLabelSettings(
  fallback?: Partial<Pick<ProjectDetailsRecord, "name" | "brandName" | "domain" | "primaryLanguage">>,
): ProjectWhiteLabelSettings {
  const platformName = firstNonEmpty(fallback?.brandName || "", fallback?.name || "", "Client Workspace");
  const locale = normalizeLocale(getString(fallback?.primaryLanguage));

  return {
    version: 1,
    branding: {
      platformName,
      logoUrl: "",
      faviconUrl: "",
      primaryColor: DEFAULT_PRIMARY_COLOR,
      secondaryColor: DEFAULT_SECONDARY_COLOR,
      accentColor: DEFAULT_ACCENT_COLOR,
      fontFamily: DEFAULT_FONT_FAMILY,
      emailFromName: platformName,
      emailReplyTo: "",
      customDomain: getString(fallback?.domain),
    },
    reporting: {
      template: "executive",
      locale,
      timezone: DEFAULT_TIMEZONE,
      frequency: "monthly",
      recipients: [],
      liveShareEnabled: false,
      shareLinkTTLHours: DEFAULT_SHARE_TTL_HOURS,
    },
  };
}

export function normalizeWhiteLabelSettings(
  value: unknown,
  fallback?: Partial<Pick<ProjectDetailsRecord, "name" | "brandName" | "domain" | "primaryLanguage">>,
): ProjectWhiteLabelSettings {
  const base = buildDefaultWhiteLabelSettings(fallback);
  const payload = isRecord(value) ? value : {};
  const brandingValue = getField(payload, ["branding", "Branding"]);
  const reportingValue = getField(payload, ["reporting", "Reporting"]);
  const branding: Record<string, unknown> = isRecord(brandingValue) ? brandingValue : {};
  const reporting: Record<string, unknown> = isRecord(reportingValue) ? reportingValue : {};

  const platformName = firstNonEmpty(
    getString(getField(branding, ["platformName", "PlatformName"])),
    base.branding.platformName,
  );

  return {
    version: Math.max(1, getNumber(getField(payload, ["version", "Version"])) || base.version),
    branding: {
      platformName,
      logoUrl: getString(getField(branding, ["logoUrl", "LogoURL"])) || base.branding.logoUrl,
      faviconUrl: getString(getField(branding, ["faviconUrl", "FaviconURL"])) || base.branding.faviconUrl,
      primaryColor: getString(getField(branding, ["primaryColor", "PrimaryColor"])) || base.branding.primaryColor,
      secondaryColor: getString(getField(branding, ["secondaryColor", "SecondaryColor"])) || base.branding.secondaryColor,
      accentColor: getString(getField(branding, ["accentColor", "AccentColor"])) || base.branding.accentColor,
      fontFamily: getString(getField(branding, ["fontFamily", "FontFamily"])) || base.branding.fontFamily,
      emailFromName: getString(getField(branding, ["emailFromName", "EmailFromName"])) || platformName,
      emailReplyTo: getString(getField(branding, ["emailReplyTo", "EmailReplyTo"])) || base.branding.emailReplyTo,
      customDomain: getString(getField(branding, ["customDomain", "CustomDomain"])) || base.branding.customDomain,
    },
    reporting: {
      template: normalizeTemplate(getString(getField(reporting, ["template", "Template"]))),
      locale: normalizeLocale(
        getString(getField(reporting, ["locale", "Locale"])) || base.reporting.locale,
      ),
      timezone: getString(getField(reporting, ["timezone", "Timezone"])) || base.reporting.timezone,
      frequency: normalizeFrequency(getString(getField(reporting, ["frequency", "Frequency"]))),
      recipients: getStringArray(getField(reporting, ["recipients", "Recipients"])),
      liveShareEnabled: getBoolean(getField(reporting, ["liveShareEnabled", "LiveShareEnabled"])),
      shareLinkTTLHours: normalizeShareTTL(
        getNumber(getField(reporting, ["shareLinkTTLHours", "ShareLinkTTLHours"])) || base.reporting.shareLinkTTLHours,
      ),
    },
  };
}

export function serializeWhiteLabelSettings(value: ProjectWhiteLabelSettings): string {
  return JSON.stringify(value);
}

export function normalizeProjectDetailsRecord(value: unknown): ProjectDetailsRecord | null {
  const payload = unwrapSuccessEnvelope(value);
  if (!isRecord(payload)) return null;

  const id = getIDString(getField(payload, ["id", "ID"]));
  if (id === "") return null;

  const recordBase = {
    name: getString(getField(payload, ["name", "Name"])) || "Project",
    brandName: getString(getField(payload, ["brandName", "BrandName"])),
    domain: getString(getField(payload, ["domain", "Domain"])),
    primaryLanguage: getString(getField(payload, ["primaryLanguage", "PrimaryLanguage"])) || "fr",
  };

  return {
    id,
    name: recordBase.name,
    status: getString(getField(payload, ["status", "Status"])) || "draft",
    domain: recordBase.domain,
    websiteUrl: getString(getField(payload, ["websiteUrl", "WebsiteURL"])),
    brandName: recordBase.brandName,
    brandDescription: getString(getField(payload, ["brandDescription", "BrandDescription"])),
    attributionSource: getString(getField(payload, ["attributionSource", "AttributionSource"])),
    industry: getString(getField(payload, ["industry", "Industry"])),
    primaryLanguage: recordBase.primaryLanguage,
    country: getString(getField(payload, ["country", "Country"])) || "FR",
    whiteLabel: normalizeWhiteLabelSettings(getField(payload, ["whiteLabel", "WhiteLabel"]), recordBase),
    createdAt: getString(getField(payload, ["createdAt", "CreatedAt"])),
    updatedAt: getString(getField(payload, ["updatedAt", "UpdatedAt"])),
  };
}

export async function loadProjectDetailsRecord(
  apiBaseURL: string,
  organizationId: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<ProjectDetailsRecord | null> {
  const response = await gatewayJSON<unknown>(apiBaseURL, apiRoutes.projects.get(encodeURIComponent(projectId)), {
    method: "GET",
    organizationId,
    signal,
  });

  if (!response.ok) {
    throw new Error(response.error || "Impossible de charger ce projet.");
  }

  return normalizeProjectDetailsRecord(response.data);
}
