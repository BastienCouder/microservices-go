import { describe, expect, test } from "bun:test";

import {
  buildTopCitedPagesFromPrompts,
  getSentimentCounts,
  matchesPromptAudienceFilters,
} from "./analytics-utils";

describe("matchesPromptAudienceFilters", () => {
  test("requires brand and competitor co-mention when competitor filters are active", () => {
    expect(
      matchesPromptAudienceFilters(
        {
          modelId: "gpt-4o",
          persona: "",
          competitorsMentioned: ["Adidas"],
          mention: true,
        },
        [],
        [],
        ["Adidas"],
      ),
    ).toBe(true);

    expect(
      matchesPromptAudienceFilters(
        {
          modelId: "gpt-4o",
          persona: "",
          competitorsMentioned: ["Adidas"],
          mention: false,
        },
        [],
        [],
        ["Adidas"],
      ),
    ).toBe(false);
  });
});

describe("getSentimentCounts", () => {
  test("uses explicit sentiment values instead of derived score thresholds", () => {
    const counts = getSentimentCounts([
      {
        sentiment: "positive",
      },
      {
        sentiment: "neutral",
      },
      {
        sentiment: "negative",
      },
      {
        sentiment: "",
      },
    ]);

    expect(counts).toEqual({
      positive: 1,
      neutral: 2,
      negative: 1,
    });
  });
});

describe("buildTopCitedPagesFromPrompts", () => {
  test("aggregates cited pages from the filtered prompts scope", () => {
    const pages = buildTopCitedPagesFromPrompts([
      {
        citedUrls: ["https://www.nike.com/running", "https://www.nike.com/running"],
      },
      {
        citedUrls: ["https://www.nike.com/contact"],
      },
      {
        citedUrls: [],
      },
    ]);

    expect(pages).toEqual([
      { url: "/running", value: 67 },
      { url: "/contact", value: 33 },
    ]);
  });
});
