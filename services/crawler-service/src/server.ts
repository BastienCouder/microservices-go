import crypto from "node:crypto";
import type { LookupAddress } from "node:dns";
import dns from "node:dns/promises";
import fs from "node:fs";
import http, { type IncomingMessage, type ServerResponse } from "node:http";
import net from "node:net";
import { Pool } from "pg";
import puppeteer, { type HTTPRequest, type Page } from "puppeteer-core";
import TurndownService from "turndown";

type CrawlKind = "discovery" | "markdown";
type CrawlStatus = "queued" | "running" | "completed" | "partially_completed" | "errored";
type PageStatus = "completed" | "errored";
type QualityStatus = "empty" | "suspect" | "good";

type CreateCrawlBody = {
  url?: unknown;
  organizationId?: unknown;
  projectId?: unknown;
  limit?: unknown;
  depth?: unknown;
  options?: {
    includePatterns?: unknown;
  };
};

type RenderedLink = {
  title: string;
  url: string;
};

type RenderedPage = {
  url: string;
  title: string;
  links: RenderedLink[];
  markdown: string;
  httpStatus: number;
};

type MarkdownQuality = {
  score: number;
  status: QualityStatus;
  notes: string[];
};

type PageRecord = {
  url: string;
  title?: string;
  sourceURL?: string;
  status: PageStatus;
  httpStatus?: number | null;
  markdown?: string | null;
  quality?: MarkdownQuality;
  error?: string | null;
  attempts?: number;
  startedAt?: Date;
  completedAt?: Date;
};

type CrawlRunRow = {
  id: string;
  organization_id: number;
  project_id: string;
  kind: CrawlKind;
  status: CrawlStatus;
  root_url: string;
  page_limit: number;
  depth_limit: number;
  include_urls: unknown;
  total_pages: number;
  completed_pages: number;
  failed_pages: number;
  error: string | null;
  created_at: Date;
  updated_at: Date;
};

type LatestRunRow = {
  id: string;
  created_at: Date;
  updated_at: Date;
};

const port = Number(process.env.PORT || 8094);
const browserWSEndpoint = process.env.OBSCURA_WS || "ws://obscura:9222/devtools/browser";
const concurrency = Math.max(1, Number(process.env.CRAWLER_CONCURRENCY || 3));
const navigationTimeout = Math.max(5_000, Number(process.env.CRAWLER_NAVIGATION_TIMEOUT_MS || 45_000));

function secret(name: string, fileName: string): string {
  if (process.env[name]) return process.env[name].trim();
  const file = process.env[fileName];
  return file ? fs.readFileSync(file, "utf8").trim() : "";
}

const databasePassword = secret("ANALYSIS_DB_PASSWORD", "ANALYSIS_DB_PASSWORD_FILE");
const databaseURL =
  process.env.DATABASE_URL ||
  `postgres://${encodeURIComponent(process.env.ANALYSIS_DB_USER || "analysissvc")}:${encodeURIComponent(databasePassword)}@${process.env.ANALYSIS_DB_HOST || "postgres"}:${process.env.ANALYSIS_DB_PORT || "5432"}/${process.env.ANALYSIS_DB_NAME || "analysissvc"}?sslmode=${process.env.ANALYSIS_DB_SSLMODE || "disable"}`;
const serviceToken = secret("CRAWLER_SERVICE_TOKEN", "CRAWLER_SERVICE_TOKEN_FILE");
const dnsServers = (process.env.CRAWLER_DNS_SERVERS || "1.1.1.1,8.8.8.8")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const externalResolver = new dns.Resolver();
if (dnsServers.length > 0) {
  externalResolver.setServers(dnsServers);
}
const pool = new Pool({ connectionString: databaseURL });
const activeJobs = new Set<string>();
const nonContentExtensions = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".avif",
  ".svg",
  ".ico",
  ".mp4",
  ".webm",
  ".mov",
  ".avi",
  ".mp3",
  ".wav",
  ".ogg",
  ".css",
  ".js",
  ".mjs",
  ".map",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".json",
  ".xml",
  ".rss",
] as const;

function json(res: ServerResponse, status: number, payload: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

async function body(req: IncomingMessage): Promise<CreateCrawlBody> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) throw new Error("request body too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as CreateCrawlBody;
}

function isPrivateIP(address: string): boolean {
  if (net.isIPv4(address)) {
    const [a = 0, b = 0] = address.split(".").map(Number);
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168)
    );
  }
  const value = address.toLowerCase();
  return value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80:");
}

function sameRegistrableHost(hostname: string, allowedHost: string): boolean {
  return hostname.replace(/^www\./, "") === allowedHost.replace(/^www\./, "");
}

function isLikelyContentURL(url: URL): boolean {
  const lowerPath = url.pathname.toLowerCase();
  return !nonContentExtensions.some((extension) => lowerPath.endsWith(extension));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableDNSError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as NodeJS.ErrnoException).code;
  return (
    code === "EAI_AGAIN" ||
    code === "ESERVFAIL" ||
    code === "ETIMEOUT" ||
    code === "ECONNREFUSED"
  );
}

async function resolveHostname(hostname: string): Promise<LookupAddress[]> {
  if (dnsServers.length === 0) {
    return dns.lookup(hostname, { all: true });
  }

  const [ipv4, ipv6] = await Promise.allSettled([
    externalResolver.resolve4(hostname),
    externalResolver.resolve6(hostname),
  ]);
  const addresses: LookupAddress[] = [];
  if (ipv4.status === "fulfilled") {
    addresses.push(...ipv4.value.map((address) => ({ address, family: 4 })));
  }
  if (ipv6.status === "fulfilled") {
    addresses.push(...ipv6.value.map((address) => ({ address, family: 6 })));
  }
  if (addresses.length > 0) return addresses;

  const reason =
    ipv4.status === "rejected"
      ? ipv4.reason
      : ipv6.status === "rejected"
        ? ipv6.reason
        : null;
  throw reason instanceof Error ? reason : new Error(`unable to resolve ${hostname}`);
}

async function lookupHostname(hostname: string): Promise<LookupAddress[]> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await resolveHostname(hostname);
    } catch (error) {
      lastError = error;
      if (!isRetryableDNSError(error) || attempt === 2) break;
      await sleep(250 * (attempt + 1));
    }
  }
  const message = lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`DNS lookup failed for ${hostname}: ${message}`);
}

async function safeURL(raw: string | URL, allowedHost = ""): Promise<URL> {
  const parsed = raw instanceof URL ? new URL(raw.toString()) : new URL(String(raw || "").trim());
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("only http/https URLs are allowed");
  if (allowedHost && !sameRegistrableHost(parsed.hostname, allowedHost)) {
    throw new Error("URL is outside the crawl domain");
  }
  const addresses = await lookupHostname(parsed.hostname);
  if (!addresses.length || addresses.some(({ address }) => isPrivateIP(address))) {
    throw new Error("private or unresolved targets are not allowed");
  }
  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (key.startsWith("utm_") || ["fbclid", "gclid", "mc_cid", "mc_eid"].includes(key)) {
      parsed.searchParams.delete(key);
    }
  }
  if (parsed.pathname !== "/" && parsed.pathname.endsWith("/")) {
    parsed.pathname = parsed.pathname.slice(0, -1);
  }
  return parsed;
}

function cleanMarkdown(markdown: string): string {
  let text = markdown.replace(/\r\n/g, "\n").replace(/\n{4,}/g, "\n\n\n");

  const lines = text.split("\n");
  const cleanedLines: string[] = [];
  let previous: string | null = null;

  for (const line of lines) {
    const current = line.trim();
    if (current && current === previous) continue;
    cleanedLines.push(line);
    previous = current;
  }

  text = cleanedLines.join("\n").trim();

  const firstH1 = text.search(/^#\s+\S+/m);
  if (firstH1 > 500) {
    text = text.slice(firstH1).trim();
  }

  const half = Math.floor(text.length / 2);
  const firstHalf = text.slice(0, half).trim();
  const secondHalf = text.slice(half).trim();
  if (firstHalf.length > 1000 && secondHalf.length > 1000 && firstHalf === secondHalf) {
    text = firstHalf;
  }

  const blocks = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((value) => value.trim())
    .filter(Boolean);
  const seen = new Set<string>();
  return blocks
    .filter((block) => {
      const normalized = block.replace(/\s+/g, " ");
      if (seen.has(normalized)) return false;
      seen.add(normalized);
      return true;
    })
    .join("\n\n")
    .trim();
}

function markdownQuality(markdown: string): MarkdownQuality {
  const text = markdown.trim();
  const chars = text.length;
  const words = text.replace(/[^\p{L}\p{N}\s'-]/gu, " ").split(/\s+/).filter(Boolean).length;
  const links = (text.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  const images = (text.match(/!\[[^\]]*]\([^)]+\)/g) || []).length;
  const headings = (text.match(/^#{1,6}\s+\S+/gm) || []).length;
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const uniqueLines = new Set(lines);
  const duplicateRatio = lines.length > 0 ? 1 - uniqueLines.size / lines.length : 0;
  const linkRatio = words > 0 ? links / words : links;
  const imageRatio = words > 0 ? images / words : images;
  let score = 100;
  const notes: string[] = [];
  if (chars < 300) {
    score -= 40;
    notes.push("too-short");
  }
  if (words < 50) {
    score -= 30;
    notes.push("too-few-words");
  }
  if (!headings) {
    score -= 15;
    notes.push("no-heading");
  }
  if (linkRatio > 0.25) {
    score -= 20;
    notes.push("too-many-links");
  }
  if (imageRatio > 0.15) {
    score -= 10;
    notes.push("too-many-images");
  }
  if (duplicateRatio > 0.35) {
    score -= 20;
    notes.push("many-duplicate-lines");
  }
  score = Math.max(0, Math.min(100, score));
  return { score, status: !text ? "empty" : score < 60 ? "suspect" : "good", notes };
}

async function withPage<T>(callback: (page: Page) => Promise<T>): Promise<T> {
  const browser = await puppeteer.connect({ browserWSEndpoint });
  const page = await browser.newPage();
  page.setDefaultNavigationTimeout(navigationTimeout);
  try {
    return await callback(page);
  } finally {
    await page.close().catch(() => undefined);
    await browser.disconnect();
  }
}

async function validateRequestURL(request: HTTPRequest, rootHost: string): Promise<void> {
  const requestURL = new URL(request.url());
  if (!["http:", "https:"].includes(requestURL.protocol)) return;
  await safeURL(requestURL, request.isNavigationRequest() ? rootHost : "");
}

async function readRenderedPage(rawURL: string | URL, rootHost: string, includeMarkdown: boolean): Promise<RenderedPage> {
  const target = await safeURL(rawURL, rootHost);
  return withPage(async (page) => {
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      void validateRequestURL(request, rootHost)
        .then(() => request.continue())
        .catch(() => request.abort());
    });

    const response = await page.goto(target.toString(), { waitUntil: "domcontentloaded" });
    const finalURL = await safeURL(page.url(), rootHost);
    const result = await page.evaluate(() => ({
      title: document.title || "",
      html: document.documentElement?.outerHTML || "",
      links: [...document.querySelectorAll("a[href]")].map((a) => ({
        title: (a.getAttribute("aria-label") || a.getAttribute("title") || a.textContent || "").replace(/\s+/g, " ").trim(),
        url: (a as HTMLAnchorElement).href,
      })),
    }));

    let markdown = "";
    if (includeMarkdown) {
      const turndown = new TurndownService({ headingStyle: "atx", codeBlockStyle: "fenced" });
      turndown.remove(["script", "style", "noscript", "svg" as keyof HTMLElementTagNameMap]);
      markdown = cleanMarkdown(turndown.turndown(result.html));
    }

    return {
      url: finalURL.toString(),
      title: result.title,
      links: result.links,
      markdown,
      httpStatus: response?.status() || 0,
    };
  });
}

async function sitemapURLs(root: URL): Promise<string[]> {
  const pending = [new URL("/sitemap.xml", root).toString()];
  const found = new Set<string>();
  const visited = new Set<string>();

  while (pending.length && visited.size < 10) {
    const rawURL = pending.shift();
    if (!rawURL) continue;

    let target: URL;
    try {
      target = await safeURL(rawURL, root.hostname);
    } catch {
      continue;
    }
    if (visited.has(target.toString())) continue;
    visited.add(target.toString());

    try {
      const response = await fetch(target, {
        signal: AbortSignal.timeout(10_000),
        headers: { "user-agent": "ObscuraCrawler/1.0" },
      });
      if (!response.ok) continue;
      const xml = (await response.text()).slice(0, 2_000_000);
      for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
        const value = (match[1] || "").replaceAll("&amp;", "&").trim();
        if (/\.xml(?:\.gz)?(?:\?|$)/i.test(value)) {
          pending.push(value);
          continue;
        }
        try {
          const candidate = await safeURL(value, root.hostname);
          if (isLikelyContentURL(candidate)) found.add(candidate.toString());
        } catch {
          // Ignore sitemap entries outside policy.
        }
      }
    } catch {
      // Sitemap discovery is best-effort; rendered links still cover the core path.
    }
  }

  return [...found];
}

async function insertPage(jobID: string, record: PageRecord, position: number): Promise<void> {
  await pool.query(
    `
    INSERT INTO crawler_pages (run_id, normalized_url, title, source_url, position, status, http_status, markdown, markdown_chars, quality_score, quality_status, quality_notes, error, attempts, started_at, completed_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
    ON CONFLICT (run_id, normalized_url) DO UPDATE SET
      title=EXCLUDED.title, status=EXCLUDED.status, http_status=EXCLUDED.http_status,
      markdown=EXCLUDED.markdown, markdown_chars=EXCLUDED.markdown_chars,
      quality_score=EXCLUDED.quality_score, quality_status=EXCLUDED.quality_status,
      quality_notes=EXCLUDED.quality_notes, error=EXCLUDED.error, attempts=EXCLUDED.attempts,
      started_at=EXCLUDED.started_at, completed_at=EXCLUDED.completed_at
  `,
    [
      jobID,
      record.url,
      record.title || "",
      record.sourceURL || "",
      position,
      record.status,
      record.httpStatus || null,
      record.markdown || null,
      record.markdown?.length || 0,
      record.quality?.score ?? null,
      record.quality?.status ?? null,
      record.quality?.notes?.join(",") || null,
      record.error || null,
      record.attempts || 1,
      record.startedAt || null,
      record.completedAt || null,
    ],
  );
}

async function discover(job: CrawlRunRow): Promise<void> {
  const root = await safeURL(job.root_url);
  const sitemap = await sitemapURLs(root);
  const limited = job.page_limit > 0;
  const queue: { url: string; depth: number; sourceURL: string }[] = [
    { url: root.toString(), depth: 0, sourceURL: "" },
    ...(limited ? sitemap.slice(0, Math.max(0, job.page_limit - 1)) : sitemap).map((url) => ({
      url,
      depth: job.depth_limit,
      sourceURL: "sitemap",
    })),
  ];
  const seen = new Set<string>();
  let position = 0;

  while (queue.length && (!limited || seen.size < job.page_limit)) {
    const current = queue.shift();
    if (!current) continue;

    let target: URL;
    try {
      target = await safeURL(current.url, root.hostname);
    } catch {
      continue;
    }
    if (!isLikelyContentURL(target)) continue;
    if (seen.has(target.toString())) continue;
    seen.add(target.toString());

    const startedAt = new Date();
    try {
      const page = await readRenderedPage(target, root.hostname, false);
      position += 1;
      await insertPage(
        job.id,
        { ...page, sourceURL: current.sourceURL, status: "completed", startedAt, completedAt: new Date() },
        position,
      );
      if (current.depth < job.depth_limit) {
        for (const link of page.links) {
          queue.push({ url: link.url, depth: current.depth + 1, sourceURL: page.url });
        }
      }
    } catch (error) {
      position += 1;
      await insertPage(
        job.id,
        {
          url: target.toString(),
          sourceURL: current.sourceURL,
          status: "errored",
          error: error instanceof Error ? error.message : String(error),
          startedAt,
          completedAt: new Date(),
        },
        position,
      );
    }
    await updateProgress(job.id);
  }
}

function includeURLsFromJob(job: CrawlRunRow): string[] {
  if (Array.isArray(job.include_urls)) return job.include_urls.map(String);
  if (typeof job.include_urls === "string") {
    try {
      const parsed = JSON.parse(job.include_urls) as unknown;
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
}

async function crawlSelected(job: CrawlRunRow): Promise<void> {
  const urls = includeURLsFromJob(job);
  const root = await safeURL(job.root_url);
  let next = 0;

  async function worker(): Promise<void> {
    while (next < urls.length) {
      const position = next++;
      const rawURL = urls[position];
      if (!rawURL) continue;

      const startedAt = new Date();
      try {
        const page = await readRenderedPage(rawURL, root.hostname, true);
        const quality = markdownQuality(page.markdown);
        await insertPage(job.id, { ...page, status: "completed", quality, startedAt, completedAt: new Date() }, position + 1);
      } catch (error) {
        await insertPage(
          job.id,
          {
            url: rawURL,
            status: "errored",
            error: error instanceof Error ? error.message : String(error),
            startedAt,
            completedAt: new Date(),
          },
          position + 1,
        );
      }
      await updateProgress(job.id);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, () => worker()));
}

async function updateProgress(jobID: string): Promise<void> {
  await pool.query(
    `
    UPDATE crawler_runs r SET
      total_pages=CASE WHEN r.kind='discovery' THEN (SELECT count(*) FROM crawler_pages WHERE run_id=r.id) ELSE r.total_pages END,
      completed_pages=(SELECT count(*) FROM crawler_pages WHERE run_id=r.id AND status='completed'),
      failed_pages=(SELECT count(*) FROM crawler_pages WHERE run_id=r.id AND status='errored'),
      updated_at=NOW()
    WHERE id=$1
  `,
    [jobID],
  );
}

async function execute(jobID: string): Promise<void> {
  if (activeJobs.has(jobID)) return;
  activeJobs.add(jobID);
  try {
    const { rows } = await pool.query<CrawlRunRow>(
      "UPDATE crawler_runs SET status='running', started_at=COALESCE(started_at,NOW()), updated_at=NOW() WHERE id=$1 AND status='queued' RETURNING *",
      [jobID],
    );
    const job = rows[0];
    if (!job) return;

    if (job.kind === "discovery") await discover(job);
    else await crawlSelected(job);

    await updateProgress(jobID);
    await pool.query(
      "UPDATE crawler_runs SET status=CASE WHEN failed_pages>0 THEN 'partially_completed' ELSE 'completed' END, finished_at=NOW(), updated_at=NOW() WHERE id=$1",
      [jobID],
    );
  } catch (error) {
    await pool
      .query("UPDATE crawler_runs SET status='errored', error=$2, finished_at=NOW(), updated_at=NOW() WHERE id=$1", [
        jobID,
        error instanceof Error ? error.message : String(error),
      ])
      .catch(() => undefined);
  } finally {
    activeJobs.delete(jobID);
  }
}

function normalizeIncludeURLs(input: CreateCrawlBody): string[] {
  const raw = input.options?.includePatterns;
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.map(String).map((value) => value.trim()).filter(Boolean))];
}

async function createJob(input: CreateCrawlBody): Promise<{ id: string; status: "queued" }> {
  const root = await safeURL(String(input.url || ""));
  const includeURLs = normalizeIncludeURLs(input);
  for (const value of includeURLs) await safeURL(value, root.hostname);

  const id = crypto.randomUUID();
  const kind: CrawlKind = includeURLs.length ? "markdown" : "discovery";
  const requestedLimit = Number(input.limit || 0);
  const limit =
    kind === "discovery"
      ? Math.max(0, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : 0)
      : Math.min(1000, Math.max(1, Number.isFinite(requestedLimit) ? Math.floor(requestedLimit) : includeURLs.length || 1));
  const depth = Math.min(25, Math.max(1, Number(input.depth || 2)));

  await pool.query(
    `
    INSERT INTO crawler_runs (id, organization_id, project_id, kind, status, root_url, page_limit, depth_limit, include_urls, total_pages)
    VALUES ($1,$2,$3,$4,'queued',$5,$6,$7,$8::jsonb,$9)
  `,
    [
      id,
      Number(input.organizationId),
      String(input.projectId || ""),
      kind,
      root.toString(),
      limit,
      depth,
      JSON.stringify(includeURLs),
      includeURLs.length,
    ],
  );

  setImmediate(() => void execute(id));
  return { id, status: "queued" };
}

async function getJob(id: string, query: URLSearchParams): Promise<unknown | null> {
  const { rows } = await pool.query<CrawlRunRow>("SELECT * FROM crawler_runs WHERE id=$1", [id]);
  const run = rows[0];
  if (!run) return null;

  const params: unknown[] = [id];
  let where = "run_id=$1";
  const status = query.get("status");
  if (status) {
    params.push(status);
    where += ` AND status=$${params.length}`;
  }
  const rawLimit = query.get("limit");
  const limit = rawLimit ? Math.min(1000, Math.max(1, Number(rawLimit))) : 0;
  const limitClause = limit > 0 ? ` LIMIT $${params.length + 1}` : "";
  if (limit > 0) params.push(limit);

  const pages = await pool.query(
    `SELECT normalized_url AS url,status,http_status AS "httpStatus",title,markdown,error,position FROM crawler_pages WHERE ${where} ORDER BY position${limitClause}`,
    params,
  );

  return {
    id: run.id,
    status: run.status,
    total: Number(run.total_pages),
    finished: Number(run.completed_pages) + Number(run.failed_pages),
    failed: Number(run.failed_pages),
    records: pages.rows,
  };
}

function authorized(req: IncomingMessage): boolean {
  return !serviceToken || req.headers.authorization === `Bearer ${serviceToken}`;
}

const server = http.createServer((req, res) => {
  void (async () => {
    try {
      if (req.url === "/health") return json(res, 200, { ok: true });
      if (!authorized(req)) return json(res, 401, { error: "unauthorized" });

      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (req.method === "POST" && url.pathname === "/internal/crawls") {
        return json(res, 201, await createJob(await body(req)));
      }

      if (req.method === "GET" && url.pathname === "/internal/crawls/latest") {
        const { rows } = await pool.query<LatestRunRow>(
          "SELECT id, created_at, updated_at FROM crawler_runs WHERE organization_id=$1 AND project_id=$2 AND kind='markdown' ORDER BY created_at DESC LIMIT 1",
          [url.searchParams.get("organizationId"), url.searchParams.get("projectId")],
        );
        const run = rows[0];
        if (!run) return json(res, 200, null);
        const result = await getJob(run.id, new URLSearchParams());
        return json(res, 200, {
          projectId: url.searchParams.get("projectId"),
          organizationId: Number(url.searchParams.get("organizationId")),
          jobId: run.id,
          result,
          createdAt: run.created_at,
          updatedAt: run.updated_at,
        });
      }

      const match = url.pathname.match(
        /^\/internal\/crawls\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i,
      );
      if (req.method === "GET" && match?.[1]) {
        const job = await getJob(match[1], url.searchParams);
        return job ? json(res, 200, job) : json(res, 404, { error: "crawl not found" });
      }

      return json(res, 404, { error: "not found" });
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : "request failed" });
    }
  })();
});

await pool.query("SELECT 1");
const recover = await pool.query<{ id: string }>(
  "UPDATE crawler_runs SET status='queued', error=NULL WHERE status IN ('queued','running') RETURNING id",
);
for (const row of recover.rows) {
  setImmediate(() => void execute(row.id));
}

server.listen(port, "0.0.0.0", () => {
  console.log(`crawler-service listening on :${port}`);
});

async function shutdown(): Promise<void> {
  server.close();
  await pool.end();
}

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});
process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
