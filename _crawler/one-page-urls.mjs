import puppeteer from 'puppeteer-core';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const START_URL = process.argv[2] ?? 'https://nike.com/';
const OUTPUT_DIR = process.argv[3] ?? 'output';

const WS_ENDPOINT =
  process.env.OBSCURA_WS ??
  'ws://127.0.0.1:9222/devtools/browser';

const WRITE_CSV = process.env.WRITE_CSV === '1';
const BLOCK_SCRIPTS = process.env.BLOCK_SCRIPTS === '1';

function nowMs() {
  return Number(process.hrtime.bigint() / 1_000_000n);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

const totalStart = nowMs();

console.log(`Start URL: ${START_URL}`);
console.log(`Output dir: ${OUTPUT_DIR}`);
console.log(`Block scripts: ${BLOCK_SCRIPTS ? 'yes' : 'no'}`);

const connectStart = nowMs();

const browser = await puppeteer.connect({
  browserWSEndpoint: WS_ENDPOINT,
});

console.log(`Browser connected in ${formatDuration(nowMs() - connectStart)}`);

const page = await browser.newPage();

await page.setRequestInterception(true);

page.on('request', request => {
  const type = request.resourceType();

  const blockedTypes = new Set([
    'image',
    'stylesheet',
    'font',
    'media',
    'xhr',
    'fetch',
    'manifest',
    'other',
  ]);

  if (BLOCK_SCRIPTS) {
    blockedTypes.add('script');
  }

  if (blockedTypes.has(type)) {
    request.abort();
  } else {
    request.continue();
  }
});

const gotoStart = nowMs();

await page.goto(START_URL, {
  waitUntil: 'domcontentloaded',
  timeout: 20_000,
});

const pageLoadTime = nowMs() - gotoStart;
const currentUrl = page.url();

console.log(`Page loaded in ${formatDuration(pageLoadTime)}`);
console.log(`Final URL: ${currentUrl}`);

const extractStart = nowMs();

const data = await page.evaluate(() => {
  const badExtensions = [
    '.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif', '.svg', '.ico',
    '.mp4', '.webm', '.mov', '.avi', '.mp3', '.wav', '.ogg',
    '.css', '.js', '.mjs', '.map',
    '.woff', '.woff2', '.ttf', '.otf',
    '.pdf', '.zip', '.tar', '.gz', '.rar', '.7z',
    '.json', '.xml', '.rss',
  ];

  function cleanHost(hostname) {
    return hostname.replace(/^www\./, '');
  }

  function cleanTitle(value) {
    return String(value ?? '')
      .replace(/<style[\s\S]*?<\/style>/gi, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\.css-[^{]+{[^}]*}/g, '')
      .replace(/@media[^{]*{[^}]*}/g, '')
      .replace(/@media[^{]*{\s*}/g, '')
      .replace(/[{}]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  const root = new URL(location.href);
  const rootHost = cleanHost(root.hostname);
  const deduped = new Map();

  const anchors = document.querySelectorAll('a[href]');

  for (const a of anchors) {
    try {
      const url = new URL(a.href, location.href);

      if (!['http:', 'https:'].includes(url.protocol)) continue;
      if (cleanHost(url.hostname) !== rootHost) continue;

      url.hash = '';

      if (url.pathname !== '/' && url.pathname.endsWith('/')) {
        url.pathname = url.pathname.slice(0, -1);
      }

      const lowerPath = url.pathname.toLowerCase();

      if (badExtensions.some(ext => lowerPath.endsWith(ext))) {
        continue;
      }

      for (const key of [...url.searchParams.keys()]) {
        if (
          key.startsWith('utm_') ||
          ['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(key)
        ) {
          url.searchParams.delete(key);
        }
      }

      const normalized = url.toString();

      if (deduped.has(normalized)) continue;

      const title =
        a.getAttribute('aria-label') ||
        a.getAttribute('title') ||
        a.textContent ||
        '';

      deduped.set(normalized, {
        title: cleanTitle(title),
        url: normalized,
      });
    } catch {}
  }

  return {
    rawLinks: anchors.length,
    links: [...deduped.values()],
  };
});

const extractTime = nowMs() - extractStart;

const links = data.links;
const urls = links.map(item => item.url);

console.log(`Raw links found: ${data.rawLinks}`);
console.log(`Filtered internal URLs: ${links.length}`);
console.log(`Links extracted in ${formatDuration(extractTime)}`);

const writeStart = nowMs();

await mkdir(OUTPUT_DIR, { recursive: true });

await Promise.all([
  writeFile(
    path.join(OUTPUT_DIR, 'urls.txt'),
    urls.join('\n') + '\n'
  ),

  writeFile(
    path.join(OUTPUT_DIR, 'urls.json'),
    JSON.stringify(links, null, 2)
  ),

  WRITE_CSV
    ? writeFile(
        path.join(OUTPUT_DIR, 'urls.csv'),
        [
          'title,url',
          ...links.map(item =>
            `"${item.title.replaceAll('"', '""')}","${item.url.replaceAll('"', '""')}"`
          ),
        ].join('\n') + '\n'
      )
    : Promise.resolve(),
]);

const writeTime = nowMs() - writeStart;

await page.close();
await browser.disconnect();

const totalTime = nowMs() - totalStart;

console.log(`Files written in ${formatDuration(writeTime)}`);
console.log(`Saved to ${OUTPUT_DIR}/urls.json`);
console.log(`Saved to ${OUTPUT_DIR}/urls.txt`);

if (WRITE_CSV) {
  console.log(`Saved to ${OUTPUT_DIR}/urls.csv`);
}

console.log(`Total execution time: ${formatDuration(totalTime)}`);