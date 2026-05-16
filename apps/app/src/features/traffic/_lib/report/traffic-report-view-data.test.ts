import { describe, expect, test } from "bun:test";

import { buildTrafficReportViewData } from "./traffic-report-view-data";
import type { GeoTrafficDailyPoint, GeoTrafficPage, GeoTrafficSource } from "./types";

function buildSources(count: number): GeoTrafficSource[] {
  return Array.from({ length: count }, (_, index) => ({
    source: index % 2 === 0 ? `chatgpt-${index}.com` : `perplexity-${index}.ai`,
    medium: "referral",
    sourceMedium: "referral",
    landingPage: "",
    engine: index % 2 === 0 ? "ChatGPT" : "Perplexity",
    sessions: 1000 - index,
    engagedSessions: 700 - index,
    engagementRate: 70,
    bounceRate: 30,
    avgSessionSeconds: 80,
    conversions: index,
    pageViews: 1200 - index,
    shareOfGeoSessions: 1,
  }));
}

function buildPages(count: number): GeoTrafficPage[] {
  return Array.from({ length: count }, (_, index) => ({
    path: index % 2 === 0 ? `/guide/chatgpt-${index}` : `/docs/perplexity-${index}`,
    title: index % 2 === 0 ? `ChatGPT guide ${index}` : `Perplexity docs ${index}`,
    source: index % 2 === 0 ? "chatgpt.com" : "perplexity.ai",
    engine: index % 2 === 0 ? "ChatGPT" : "Perplexity",
    sessions: 800 - index,
    engagedSessions: 600 - index,
    engagementRate: 75,
    conversions: index,
    pageViews: 900 - index,
  }));
}

function buildTimeseries(count: number): GeoTrafficDailyPoint[] {
  return Array.from({ length: count }, (_, index) => ({
    date: `2026-04-${String((index % 28) + 1).padStart(2, "0")}`,
    sessions: index + 1,
    engagedSessions: index,
    conversions: index / 10,
  }));
}

describe("buildTrafficReportViewData", () => {
  test("paginates and caps large traffic datasets returned by the backend", () => {
    const view = buildTrafficReportViewData({
      sources: buildSources(120),
      topPages: buildPages(95),
      timeseries: buildTimeseries(180),
      filters: {
        sourcePage: 2,
        topPagesPage: 3,
      },
    });

    expect(view.availableEngines).toEqual(["ChatGPT", "Perplexity"]);
    expect(view.sources.totalItems).toBe(120);
    expect(view.sources.items).toHaveLength(10);
    expect(view.sources.page).toBe(2);
    expect(view.sources.totalPages).toBe(12);
    expect(view.topPages.totalItems).toBe(95);
    expect(view.topPages.items).toHaveLength(10);
    expect(view.topPages.page).toBe(3);
    expect(view.topPages.totalPages).toBe(10);
    if (view.timeseries.length > 60) {
      throw new Error(`expected capped timeseries, got ${view.timeseries.length}`);
    }
    expect(view.timeseries[0]?.date).toBe("2026-04-01");
    expect(view.timeseries.at(-1)?.sessions).toBe(180);
  });

  test("clamps out of range pages and keeps empty results stable", () => {
    const view = buildTrafficReportViewData({
      sources: [],
      topPages: [],
      timeseries: [],
      filters: {
        sourcePage: 99,
        topPagesPage: 99,
      },
    });

    expect(view.sources.items).toHaveLength(0);
    expect(view.sources.page).toBe(1);
    expect(view.sources.totalPages).toBe(1);
    expect(view.topPages.items).toHaveLength(0);
    expect(view.topPages.page).toBe(1);
    expect(view.topPages.totalPages).toBe(1);
    expect(view.timeseries).toHaveLength(0);
  });

  test("hides private admin pages from the top pages table", () => {
    const view = buildTrafficReportViewData({
      sources: buildSources(1),
      topPages: [
        {
          path: "/admin/posts",
          title: "Articles | Admin KAHIER",
          source: "chatgpt.com",
          engine: "ChatGPT",
          sessions: 3,
          engagedSessions: 3,
          engagementRate: 100,
          conversions: 0,
          pageViews: 3,
        },
        {
          path: "/blog/application-cahier",
          title: "Application de cahier",
          source: "chatgpt.com",
          engine: "ChatGPT",
          sessions: 2,
          engagedSessions: 2,
          engagementRate: 100,
          conversions: 0,
          pageViews: 2,
        },
      ],
      timeseries: [],
      filters: {
        sourcePage: 1,
        topPagesPage: 1,
      },
    });

    expect(view.topPages.totalItems).toBe(1);
    expect(view.topPages.items[0]?.path).toBe("/blog/application-cahier");
  });
});
