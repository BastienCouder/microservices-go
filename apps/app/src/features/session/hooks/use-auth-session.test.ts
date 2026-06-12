import { describe, expect, test } from "bun:test";

const source = await Bun.file(new URL("./use-auth-session.ts", import.meta.url)).text();

describe("useAuthSession", () => {
  test("clears the persisted selection when the authenticated user changes", () => {
    expect(source.includes("const previousUserIdRef = useRef(\"\");")).toBe(true);
    expect(source.includes("if (nextUserId === \"\") {")).toBe(true);
    expect(source.includes("if (previousUserId !== \"\" && previousUserId !== nextUserId) {")).toBe(true);
    expect(source.includes("clearSelectedContext();")).toBe(true);
  });
});
