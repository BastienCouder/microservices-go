import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./sidebar.tsx", import.meta.url)).text();

describe("sidebar navigation", () => {
  test("exposes the renamed sections in the desktop sidebar", () => {
    expect(source.includes("optimizeActions")).toBe(true);
    expect(source.includes("projectSettings")).toBe(true);
    expect(source.includes("content.responses")).toBe(true);
    expect(source.includes('item(links.contentOptimizer, content.contentOptimizer)')).toBe(true);
    expect(source.includes('item(links.crawler, content.crawler)')).toBe(false);
    expect(source.includes('item(links.brands, content.brands)')).toBe(true);
    expect(source.includes('item(links.models, content.models)')).toBe(true);
    expect(source.includes('"/ai-agent-ready"')).toBe(false);
    expect(source.includes("content.adminOrganizations")).toBe(false);
    expect(source.includes('"/admin/organizations"')).toBe(false);
    expect(source.includes('.filter(({ value }) => value !== "apiKeys")')).toBe(true);
  });

  test("keeps the mobile navigation aligned with the sidebar items", async () => {
    const mobileSource = await Bun.file(
      new URL("./mobile-floating-nav.tsx", import.meta.url),
    ).text();

    expect(mobileSource.includes("OPTIMIZATION_ITEMS")).toBe(true);
    expect(mobileSource.includes("BRAND_CONTEXT_ITEMS")).toBe(true);
    expect(mobileSource.includes("SETTINGS_ITEMS")).toBe(true);
    expect(mobileSource.includes("content[item.labelKey]")).toBe(true);
    expect(mobileSource.includes('"/traffic"')).toBe(true);
    expect(mobileSource.includes('"/ai-agent-ready"')).toBe(false);
    expect(mobileSource.includes('item.labelKey === "responses"')).toBe(true);
    expect(mobileSource.includes('? location.search.slice(1) : location.search')).toBe(true);
    expect(mobileSource.includes('(item.promptTab ?? "prompts") === (activeTab || "prompts")')).toBe(true);
    expect(mobileSource.includes("org:")).toBe(false);
  });

  test("keeps organization scope out of desktop sidebar urls", () => {
    expect(source.includes('buildScopedHref("/monitoring", { project })')).toBe(true);
    expect(source.includes("const org = activeOrg?.publicId || activeOrg?.id || selectedOrgId")).toBe(false);
    expect(source.includes("org: activeOrg")).toBe(false);
  });
});
