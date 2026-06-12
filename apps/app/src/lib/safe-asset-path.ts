const IMAGE_ASSET_PATH_PATTERN = /^\/[a-z0-9/_-]+\.(svg|png|jpg|jpeg|webp)$/i;

export function toSafeImageAssetPath(value: string): string {
  const trimmed = value.trim();
  if (trimmed === "") {
    return "";
  }

  return IMAGE_ASSET_PATH_PATTERN.test(trimmed) ? trimmed : "";
}
