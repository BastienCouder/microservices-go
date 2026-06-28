import { describe, expect, test } from "bun:test";

const promptsSource = await Bun.file(
  new URL("./step-prompts.tsx", import.meta.url),
).text();
const brandSource = await Bun.file(
  new URL("./step-brand.tsx", import.meta.url),
).text();

describe("onboarding prompts", () => {
  test("starts empty and only lets the user add prompts manually", () => {
    expect(promptsSource.includes("generatePromptsWithAI")).toBe(false);
    expect(promptsSource.includes('onClick={() => addPrompt()}')).toBe(true);
    expect(brandSource.includes("setSelectedPrompts(preview.prompts)")).toBe(false);
  });
});
