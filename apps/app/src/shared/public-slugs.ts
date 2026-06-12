type SlugNamedEntity = {
  id: string;
  name: string;
};

function stripDiacritics(value: string): string {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
}

export function slugifyPublicName(value: string, fallback = "item"): string {
  const normalized = stripDiacritics(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || fallback;
}

function compareCollisionOrder(leftId: string, rightId: string): number {
  return leftId.localeCompare(rightId, "en", {
    numeric: true,
    sensitivity: "base",
  });
}

export function attachStableSlugs<T extends SlugNamedEntity>(
  items: T[],
  fallback = "item",
): Array<T & { slug: string }> {
  const groups = new Map<string, T[]>();

  for (const item of items) {
    const baseSlug = slugifyPublicName(item.name, fallback);
    const current = groups.get(baseSlug) ?? [];
    current.push(item);
    groups.set(baseSlug, current);
  }

  const slugById = new Map<string, string>();
  for (const [baseSlug, group] of groups) {
    const sortedGroup = [...group].sort((left, right) =>
      compareCollisionOrder(left.id, right.id),
    );

    sortedGroup.forEach((item, index) => {
      slugById.set(item.id, index === 0 ? baseSlug : `${baseSlug}-${index + 1}`);
    });
  }

  return items.map((item) => ({
    ...item,
    slug: slugById.get(item.id) ?? slugifyPublicName(item.name, fallback),
  }));
}

export function findBySlugOrId<T extends { id: string; slug: string }>(
  items: T[],
  value: string,
): T | null {
  const normalized = value.trim();
  if (!normalized) return null;

  return (
    items.find((item) => item.id === normalized || item.slug === normalized) ?? null
  );
}

export function findBySlugIdOrPublicId<
  T extends { id: string; slug: string; publicId?: string | null },
>(
  items: T[],
  value: string,
): T | null {
  const normalized = value.trim();
  if (!normalized) return null;

  return (
    items.find(
      (item) =>
        item.id === normalized ||
        item.slug === normalized ||
        (item.publicId?.trim() ?? "") === normalized,
    ) ?? null
  );
}
