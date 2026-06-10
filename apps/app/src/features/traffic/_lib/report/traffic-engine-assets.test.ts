import { describe, expect, test } from "bun:test";

import { getTrafficEngineIconPath } from "./traffic-engine-assets";

describe("traffic engine assets", () => {
  test("maps detected AI engines to their real SVG assets", () => {
    expect(getTrafficEngineIconPath("ChatGPT")).toBe("/models/openai.svg");
    expect(getTrafficEngineIconPath("Perplexity")).toBe("/models/perplexity.svg");
    expect(getTrafficEngineIconPath("Claude")).toBe("/models/anthropic.svg");
    expect(getTrafficEngineIconPath("Gemini")).toBe("/models/google.svg");
    expect(getTrafficEngineIconPath("Microsoft Copilot")).toBe("/models/copilot.svg");
    expect(getTrafficEngineIconPath("DeepSeek")).toBe("/models/deepseek.svg");
    expect(getTrafficEngineIconPath("Grok")).toBe("/models/grok.svg");
    expect(getTrafficEngineIconPath("Mistral")).toBe("/models/mistral.svg");
    expect(getTrafficEngineIconPath("Qwen")).toBe("/models/qwen-color.svg");
    expect(getTrafficEngineIconPath("Z.ai")).toBe("/models/zai.svg");
    expect(getTrafficEngineIconPath("Meta AI")).toBe("/models/meta.svg");
  });

  test("uses GA4 for all engines and a neutral fallback for unknown engines", () => {
    expect(getTrafficEngineIconPath("all")).toBe("/google_analytics.svg");
    expect(getTrafficEngineIconPath("Copy.ai")).toBe("/models/openai.svg");
  });
});
