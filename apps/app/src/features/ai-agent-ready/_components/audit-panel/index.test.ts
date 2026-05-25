import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./index.tsx", import.meta.url), "utf8");
const heroSource = readFileSync(new URL("./scan-hero.tsx", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../../index.tsx", import.meta.url), "utf8");

describe("AI Agent Ready audit panel", () => {
  test("keeps the pre-analysis state minimal", () => {
    expect(heroSource.includes("readOnly")).toBe(true);
    expect(heroSource.includes("Dialog")).toBe(true);
    expect(heroSource.includes("onAnalyze")).toBe(true);
    expect(source.includes("Configuration")).toBe(false);
    expect(source.includes("Load example scan")).toBe(false);
  });

  test("receives route search so the project url can be prefilled", () => {
    expect(pageSource.includes("routeSearch")).toBe(true);
  });
});
