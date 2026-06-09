const IMAGE_ASSET_PATH_PATTERN = /^\/[a-z0-9/_-]+\.(svg|png|jpg|jpeg|webp)$/i;

export function toSafeImageAssetPath(value: string, fallback = "/models/default.svg"): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return fallback;
  }

  return IMAGE_ASSET_PATH_PATTERN.test(trimmed) ? trimmed : fallback;
}
