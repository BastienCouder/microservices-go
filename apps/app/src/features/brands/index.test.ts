import { describe, expect, test } from "bun:test";

const overviewSource = await Bun.file(new URL("./_components/overview/index.tsx", import.meta.url)).text();
const editorSource = await Bun.file(new URL("./brand-canon/_components/editor/index.tsx", import.meta.url)).text();

describe("brands pages", () => {
  test("renames the overview page to Profil de marque", () => {
    expect(overviewSource.includes('title="Profil de marque"')).toBe(true);
  });

  test("keeps the overview page scrollable on mobile", () => {
    expect(overviewSource.includes("overflow-y-auto")).toBe(true);
  });

  test("keeps the brand editor scrollable on mobile", () => {
    expect(editorSource.includes("overflow-y-auto")).toBe(true);
  });

  test("uses mobile-friendly header actions and adaptive section heights", () => {
    expect(overviewSource.includes('actionsClassName="flex-row items-center justify-start translate-y-0 md:translate-y-5"')).toBe(true);
    expect(overviewSource.includes('className="max-h-[50vh] overflow-y-auto pr-1 sm:h-[220px] sm:max-h-none sm:pr-3"')).toBe(true);
    expect(overviewSource.includes('className="max-h-[50vh] overflow-y-auto pr-1 sm:h-[280px] sm:max-h-none sm:pr-3"')).toBe(true);
  });
});
