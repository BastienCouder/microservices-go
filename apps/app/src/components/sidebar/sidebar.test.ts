import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./sidebar.tsx", import.meta.url)).text();

describe("sidebar navigation", () => {
  test("exposes optimization actions in the desktop sidebar", () => {
    expect(source.includes("optimizeActions")).toBe(true);
    expect(source.includes('"/crawler"')).toBe(true);
    expect(source.includes('"/content-optimizer"')).toBe(true);
    expect(source.includes('"/error-hub"')).toBe(true);
    expect(source.includes('"/ai-agent-ready"')).toBe(true);
  });

  test("exposes translated optimization items in the mobile navigation", async () => {
    const mobileSource = await Bun.file(
      new URL("./mobile-floating-nav.tsx", import.meta.url),
    ).text();

    expect(mobileSource.includes("OPTIMIZATION_ITEMS")).toBe(true);
    expect(mobileSource.includes("content[item.labelKey]")).toBe(true);
    expect(mobileSource.includes('"/optimize/content-optimizer"')).toBe(false);
    expect(mobileSource.includes('"Content optimizer"')).toBe(false);
    expect(mobileSource.includes('"/impact"')).toBe(false);
  });
});
