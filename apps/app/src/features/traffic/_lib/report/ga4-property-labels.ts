import type { TrafficGA4OAuthProperty } from "./types";

export function getGA4PropertyDisplayLabel(property: TrafficGA4OAuthProperty): string {
  const displayName = property.displayName.trim() || property.propertyId.trim();
  const accountName = property.accountName.trim();
  const accountSuffix = accountName ? ` - ${accountName}` : "";
  return `${displayName} - ID ${property.propertyId}${accountSuffix}`;
}

export function getGA4PropertySummary(
  propertyId: string,
  properties: TrafficGA4OAuthProperty[],
): string {
  const normalizedPropertyId = propertyId.trim();
  if (!normalizedPropertyId) {
    return "";
  }
  const property = properties.find((item) => item.propertyId === normalizedPropertyId);
  if (!property) {
    return `ID ${normalizedPropertyId}`;
  }
  return getGA4PropertyDisplayLabel(property);
}
