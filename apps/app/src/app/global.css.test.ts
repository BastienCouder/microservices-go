import { describe, expect, test } from "bun:test";

const globalCss = await Bun.file(new URL("./global.css", import.meta.url)).text();

describe("global font-face sources", () => {
  test("serve Manrope font files from the public root path", () => {
    expect(globalCss.includes("../public/fonts/")).toBe(false);
    expect(globalCss.includes('url("/fonts/Manrope-Regular.ttf")')).toBe(true);
    expect(globalCss.includes('url("/fonts/Manrope-Medium.ttf")')).toBe(true);
    expect(globalCss.includes('url("/fonts/Manrope-SemiBold.ttf")')).toBe(true);
    expect(globalCss.includes('url("/fonts/Manrope-Bold.ttf")')).toBe(true);
  });
});
