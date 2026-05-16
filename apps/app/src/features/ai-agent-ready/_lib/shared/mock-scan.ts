import type { AuditScanResult } from "./types";

export const MOCK_AGENT_READY_SCAN: AuditScanResult = {
  scan_id: "mock-content-site-001",
  status: "done",
  url: "https://example.com",
  mode: "content-site",
  score: 58,
  level: "Partially Ready",
  summary: {
    passed: 3,
    failed: 2,
    warning: 1,
    skipped: 0,
  },
  categories: [
    {
      id: "discoverability",
      label: "Discoverability",
      score: 20,
      max_score: 35,
    },
    {
      id: "content",
      label: "Content",
      score: 0,
      max_score: 35,
    },
    {
      id: "bot_access",
      label: "Bot Access Control",
      score: 25,
      max_score: 30,
    },
  ],
  checks: [
    {
      id: "robots_txt",
      label: "robots.txt",
      category_id: "discoverability",
      category_label: "Discoverability",
      status: "pass",
      score: 10,
      max_score: 10,
      goal: "Expose crawl rules in a reachable robots.txt file.",
      issue: "robots.txt is reachable and declares crawler groups",
      how_to_implement:
        "Keep /robots.txt available and reference the canonical sitemap for all public content.",
      resources: [
        {
          label: "Google robots.txt",
          url: "https://developers.google.com/search/docs/crawling-indexing/robots/intro",
        },
      ],
      prompt:
        "Review robots.txt and make sure it declares a sitemap plus explicit public content crawling rules.",
      evidence: ["User-agent: *", "Allow: /", "Sitemap: https://example.com/sitemap.xml"],
    },
    {
      id: "sitemap",
      label: "Sitemap",
      category_id: "discoverability",
      category_label: "Discoverability",
      status: "fail",
      score: 0,
      max_score: 10,
      goal: "Publish a valid sitemap and reference it from robots.txt.",
      issue: "sitemap.xml not found",
      how_to_implement:
        "Generate a sitemap, keep it updated, and reference it from robots.txt.",
      resources: [{ label: "sitemaps.org", url: "https://www.sitemaps.org/" }],
      prompt: "Add a valid sitemap.xml and declare it in robots.txt.",
    },
    {
      id: "link_headers",
      label: "Link headers",
      category_id: "discoverability",
      category_label: "Discoverability",
      status: "warning",
      score: 8,
      max_score: 15,
      goal: "Expose machine-discoverable links to docs, feeds, manifests, APIs, or well-known resources.",
      issue: "Link headers exist but no .well-known or documentation target was detected",
      how_to_implement:
        "Add Link headers for docs, feeds, sitemap, or .well-known resources on the home page.",
      resources: [{ label: "RFC 8288 Web Linking", url: "https://www.rfc-editor.org/rfc/rfc8288" }],
      prompt:
        "Add useful HTTP Link headers on the home page for agent discovery of docs, feeds, APIs, or .well-known resources.",
    },
    {
      id: "markdown_negotiation",
      label: "Markdown negotiation",
      category_id: "content",
      category_label: "Content",
      status: "fail",
      score: 0,
      max_score: 35,
      goal: "Serve an agent-readable content representation when clients request text/markdown.",
      issue: "The home page returns HTML even when Accept: text/markdown is requested",
      how_to_implement:
        "Support Accept: text/markdown and return clean Markdown with headings, links, and core body text.",
      resources: [
        {
          label: "MDN content negotiation",
          url: "https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Content_negotiation",
        },
      ],
      prompt:
        "Implement Accept: text/markdown negotiation for public pages and return clean, useful Markdown content.",
    },
    {
      id: "ai_bot_rules",
      label: "AI bot rules",
      category_id: "bot_access",
      category_label: "Bot Access Control",
      status: "pass",
      score: 10,
      max_score: 10,
      goal: "Make AI crawler policy explicit instead of leaving agent access ambiguous.",
      issue: "Explicit AI crawler rules were detected",
      how_to_implement:
        "Keep AI crawler policy current as you add or remove agent access preferences.",
      resources: [{ label: "OpenAI robots.txt guidance", url: "https://platform.openai.com/docs/bots" }],
      prompt:
        "Add explicit robots.txt policy groups for known AI crawlers such as GPTBot, ChatGPT-User, ClaudeBot, Google-Extended, and PerplexityBot.",
      evidence: ["User-agent: GPTBot", "Disallow: /private"],
    },
    {
      id: "content_signals",
      label: "Content Signals",
      category_id: "bot_access",
      category_label: "Bot Access Control",
      status: "pass",
      score: 20,
      max_score: 20,
      goal: "Expose machine-readable content usage preferences where agents can discover them.",
      issue: "Content usage signals were detected",
      how_to_implement:
        "Keep the Content-Signal header or linked policy document consistent across key public pages.",
      resources: [{ label: "IETF HTTP fields", url: "https://www.rfc-editor.org/rfc/rfc9110" }],
      prompt:
        "Add a Content-Signal header or equivalent machine-readable content usage policy on public pages.",
      evidence: ["Content-Signal: ai-training=restricted"],
    },
  ],
};
