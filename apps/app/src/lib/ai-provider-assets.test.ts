import { describe, expect, test } from "bun:test";

import {
  findAIProviderAsset,
  getAIModelFamilyLabel,
  getAIProviderIconPath,
  getAIProviderLabel,
  MODEL_SVG_ICON_PATHS,
  resolveAIIconPath,
} from "./ai-provider-assets";

describe("ai provider assets", () => {
  test("resolves shared provider metadata from model names", () => {
    expect(findAIProviderAsset("gpt-4o-mini")?.provider).toBe("OpenAI");
    expect(getAIProviderLabel("claude-3-7-sonnet")).toBe("Anthropic");
    expect(getAIModelFamilyLabel("gemini-2.5-pro")).toBe("Gemini");
  });

  test("supports icon variants for traffic-specific visuals", () => {
    expect(getAIProviderIconPath("grok")).toBe("/models/xai.svg");
    expect(getAIProviderIconPath("grok", { variant: "traffic" })).toBe("/models/grok.svg");
    expect(getAIProviderIconPath("qwen", { variant: "traffic" })).toBe("/models/qwen-color.svg");
  });

  test("resolves an inferred icon when the raw path is missing or invalid", () => {
    expect(resolveAIIconPath("", "claude-3-7-sonnet")).toBe("/models/anthropic.svg");
    expect(resolveAIIconPath("https://example.com/icon.svg", "gemini-2.5-pro")).toBe("/models/google.svg");
  });

  test("exposes a deduplicated preload list", () => {
    expect(MODEL_SVG_ICON_PATHS.includes("/models/openai.svg")).toBe(true);
    expect(MODEL_SVG_ICON_PATHS.includes("/models/grok.svg")).toBe(true);
    expect(MODEL_SVG_ICON_PATHS.includes("/models/qwen-color.svg")).toBe(true);
    expect(new Set(MODEL_SVG_ICON_PATHS).size).toBe(MODEL_SVG_ICON_PATHS.length);
  });
});
