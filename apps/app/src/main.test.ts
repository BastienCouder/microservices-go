import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./main.tsx", import.meta.url)).text();

describe("main bootstrap", () => {
  test("preloads model SVG icons before rendering the app", () => {
    expect(source.includes('import { preloadModelSvgIcons } from "@/lib/asset-preload";')).toBe(true);
    expect(source.includes("preloadModelSvgIcons();")).toBe(true);
  });
});
