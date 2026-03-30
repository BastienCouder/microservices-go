export type PageSearchParams = Record<string, string | string[] | undefined>;

export function pickFirst(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0]?.trim() ?? "";
  }

  return typeof value === "string" ? value.trim() : "";
}

export function toQueryString(searchParams: PageSearchParams | undefined): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (Array.isArray(value)) {
      for (const entry of value) {
        const trimmed = entry?.trim();
        if (trimmed) {
          params.append(key, trimmed);
        }
      }
      continue;
    }

    if (typeof value === "string" && value.trim() !== "") {
      params.set(key, value.trim());
    }
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
