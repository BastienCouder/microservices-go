import type { ProjectWhiteLabelSettings } from "@/lib/project-details";

type RGB = {
  r: number;
  g: number;
  b: number;
};

const DEFAULT_PRIMARY = "#3b82f6";
const DEFAULT_SECONDARY = "#dbeafe";
const DEFAULT_ACCENT = "#0f172a";
const LIGHT_FOREGROUND = "210 40% 98%";
const DARK_FOREGROUND = "222.2 47.4% 11.2%";

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeHexColor(value: string, fallback: string): string {
  const normalized = value.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{6}$/.test(normalized)) {
    return `#${normalized.toLowerCase()}`;
  }
  if (/^[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized
      .split("")
      .map((chunk) => `${chunk}${chunk}`)
      .join("")
      .toLowerCase()}`;
  }
  return fallback;
}

function hexToRgb(value: string): RGB {
  const hex = normalizeHexColor(value, DEFAULT_PRIMARY).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }: RGB): string {
  return `#${[r, g, b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixColors(left: string, right: string, ratio: number): string {
  const from = hexToRgb(left);
  const to = hexToRgb(right);
  const weight = clamp(ratio, 0, 1);

  return rgbToHex({
    r: from.r + (to.r - from.r) * weight,
    g: from.g + (to.g - from.g) * weight,
    b: from.b + (to.b - from.b) * weight,
  });
}

function rgbToHslTriplet({ r, g, b }: RGB): string {
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const lightness = (max + min) / 2;

  if (max === min) {
    return `0 0% ${(lightness * 100).toFixed(1)}%`;
  }

  const delta = max - min;
  const saturation =
    lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);

  let hue = 0;
  switch (max) {
    case red:
      hue = (green - blue) / delta + (green < blue ? 6 : 0);
      break;
    case green:
      hue = (blue - red) / delta + 2;
      break;
    default:
      hue = (red - green) / delta + 4;
      break;
  }

  return `${((hue / 6) * 360).toFixed(2)} ${(saturation * 100).toFixed(1)}% ${(lightness * 100).toFixed(1)}%`;
}

function relativeLuminance({ r, g, b }: RGB): number {
  const transform = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  return 0.2126 * transform(r) + 0.7152 * transform(g) + 0.0722 * transform(b);
}

function readableForeground(background: string): string {
  return relativeLuminance(hexToRgb(background)) > 0.45 ? DARK_FOREGROUND : LIGHT_FOREGROUND;
}

export function resolveWhiteLabelColors(theme: ProjectWhiteLabelSettings) {
  const primary = normalizeHexColor(theme.branding.primaryColor, DEFAULT_PRIMARY);
  const secondary = normalizeHexColor(
    theme.branding.secondaryColor,
    mixColors(primary, "#ffffff", 0.78),
  );
  const accent = normalizeHexColor(
    theme.branding.accentColor,
    mixColors(primary, DEFAULT_ACCENT, 0.72),
  );

  return { primary, secondary, accent };
}

export function resolveWhiteLabelCssVariables(theme: ProjectWhiteLabelSettings): Record<string, string> {
  const { primary, secondary, accent } = resolveWhiteLabelColors(theme);

  return {
    "--primary": rgbToHslTriplet(hexToRgb(primary)),
    "--primary-foreground": readableForeground(primary),
    "--ring": rgbToHslTriplet(hexToRgb(primary)),
    "--accent": rgbToHslTriplet(hexToRgb(secondary)),
    "--secondary": rgbToHslTriplet(hexToRgb(mixColors(secondary, primary, 0.12))),
    "--chart-brand-primary": rgbToHslTriplet(hexToRgb(primary)),
    "--chart-series-1": rgbToHslTriplet(hexToRgb(primary)),
    "--chart-series-2": rgbToHslTriplet(hexToRgb(mixColors(primary, "#ffffff", 0.3))),
    "--chart-series-3": rgbToHslTriplet(hexToRgb(mixColors(primary, accent, 0.55))),
    "--sidebar-ring": rgbToHslTriplet(hexToRgb(primary)),
    "--white-label-font-family": theme.branding.fontFamily.trim(),
  };
}

export function buildWhiteLabelFavicon(theme: ProjectWhiteLabelSettings): string {
  const { primary, accent } = resolveWhiteLabelColors(theme);
  const initials = theme.branding.platformName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "CW";

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${primary}" />
          <stop offset="100%" stop-color="${accent}" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill="url(#g)" />
      <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="24" font-family="Arial, sans-serif" font-weight="700">${initials}</text>
    </svg>
  `;

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export function resolveWhiteLabelFavicon(theme: ProjectWhiteLabelSettings): string {
  const custom = theme.branding.faviconUrl.trim();
  return custom || buildWhiteLabelFavicon(theme);
}

export function resolveWhiteLabelTitle(theme: ProjectWhiteLabelSettings): string {
  return theme.branding.platformName.trim() || "Client Workspace";
}

export function resolvePreviewShareLink(
  theme: ProjectWhiteLabelSettings,
  projectName: string,
  fallbackHost: string,
): string {
  const host = theme.branding.customDomain.trim() || fallbackHost.trim() || "reports.client-workspace.local";
  const slug = (projectName || theme.branding.platformName || "report")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `https://${host}/live/${slug || "report"}`;
}
