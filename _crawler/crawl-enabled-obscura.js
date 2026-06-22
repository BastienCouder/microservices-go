import Database from 'better-sqlite3';
import { mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';

const DB_FILE = process.argv[2] ?? 'output/crawl.sqlite';
const OUTPUT_DIR = process.argv[3] ?? 'output/content';

const IMAGE = process.env.OBSCURA_IMAGE ?? 'h4ckf0r0day/obscura';
const DOCKER_TIMEOUT_MS = Number(process.env.DOCKER_TIMEOUT_MS ?? 45000);
const LIMIT = Number(process.env.LIMIT ?? 0);

function nowIso() {
  return new Date().toISOString();
}

function hashUrl(url) {
  return crypto.createHash('sha1').update(url).digest('hex').slice(0, 8);
}

function cleanName(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]+/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'page';
}

function titleFromUrl(url) {
  try {
    const u = new URL(url);
    return u.pathname.split('/').filter(Boolean).at(-1) || u.hostname;
  } catch {
    return 'page';
  }
}

function slugFor(page) {
  const title = page.title || titleFromUrl(page.url);
  return `${cleanName(title)}-${hashUrl(page.url)}`;
}

function cleanMarkdown(markdown) {
  let text = String(markdown ?? '');

  text = text.replace(/\r\n/g, '\n');
  text = text.replace(/\n{4,}/g, '\n\n\n');

  // Supprime les répétitions exactes de lignes consécutives.
  const lines = text.split('\n');
  const cleanedLines = [];

  let previous = null;

  for (const line of lines) {
    const current = line.trim();

    if (current && current === previous) {
      continue;
    }

    cleanedLines.push(line);
    previous = current;
  }

  text = cleanedLines.join('\n').trim();

  // Coupe un gros header/menu avant le premier vrai H1.
  // Règle structurelle, pas linguistique.
  const firstH1 = text.search(/^#\s+\S+/m);

  if (firstH1 > 500) {
    text = text.slice(firstH1).trim();
  }

  // Si le document entier est répété deux fois exactement,
  // on garde seulement la première moitié.
  const half = Math.floor(text.length / 2);
  const firstHalf = text.slice(0, half).trim();
  const secondHalf = text.slice(half).trim();

  if (
    firstHalf.length > 1000 &&
    secondHalf.length > 1000 &&
    firstHalf === secondHalf
  ) {
    text = firstHalf;
  }

  // Déduplication générique par blocs.
  // Utile quand header/body/footer sont répétés.
  const blocks = text
    .split(/\n{2,}/)
    .map(block => block.trim())
    .filter(Boolean);

  const seen = new Set();
  const uniqueBlocks = [];

  for (const block of blocks) {
    const normalized = block
      .replace(/\s+/g, ' ')
      .trim();

    if (!normalized) continue;

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    uniqueBlocks.push(block);
  }

  text = uniqueBlocks.join('\n\n').trim();

  return text ? `${text}\n` : '';
}

function analyzeMarkdownQuality(markdown) {
  const text = String(markdown ?? '').trim();

  const notes = [];

  const chars = text.length;

  const words = text
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean).length;

  const links = (text.match(/\[[^\]]+\]\([^)]+\)/g) || []).length;
  const images = (text.match(/!\[[^\]]*]\([^)]+\)/g) || []).length;
  const headings = (text.match(/^#{1,6}\s+\S+/gm) || []).length;

  const lines = text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  const uniqueLines = new Set(lines);

  const duplicateRatio =
    lines.length > 0 ? 1 - uniqueLines.size / lines.length : 0;

  const linkRatio = words > 0 ? links / words : links;
  const imageRatio = words > 0 ? images / words : images;

  if (chars < 300) notes.push('too-short');
  if (words < 50) notes.push('too-few-words');
  if (headings === 0) notes.push('no-heading');
  if (linkRatio > 0.25) notes.push('too-many-links');
  if (imageRatio > 0.15) notes.push('too-many-images');
  if (duplicateRatio > 0.35) notes.push('many-duplicate-lines');

  let score = 100;

  if (chars < 300) score -= 40;
  if (words < 50) score -= 30;
  if (headings === 0) score -= 15;
  if (linkRatio > 0.25) score -= 20;
  if (imageRatio > 0.15) score -= 10;
  if (duplicateRatio > 0.35) score -= 20;

  score = Math.max(0, Math.min(100, score));

  let status = 'good';

  if (chars === 0 || words === 0) {
    status = 'empty';
  } else if (score < 60) {
    status = 'suspect';
  }

  return {
    score,
    status,
    notes: notes.join(','),
    chars,
    words,
    links,
    images,
    headings,
    duplicateRatio,
    linkRatio,
    imageRatio,
  };
}

function obscuraFetch(url, dumpType) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const child = spawn(
      'docker',
      [
        'run',
        '--rm',
        IMAGE,
        'fetch',
        url,
        '--dump',
        dumpType,
      ],
      {
        stdio: ['ignore', 'pipe', 'pipe'],
      }
    );

    let stdout = '';
    let stderr = '';

    const timer = setTimeout(() => {
      if (settled) return;

      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`Timeout ${DOCKER_TIMEOUT_MS}ms: ${url}`));
    }, DOCKER_TIMEOUT_MS);

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', err => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', code => {
      if (settled) return;

      settled = true;
      clearTimeout(timer);

      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(stderr || `Obscura exited with code ${code}`));
      }
    });
  });
}

await mkdir(OUTPUT_DIR, { recursive: true });

const markdownDir = path.join(OUTPUT_DIR, 'markdown');

await mkdir(markdownDir, { recursive: true });

const db = new Database(DB_FILE);
db.pragma('journal_mode = WAL');

const hasPagesTable = db
  .prepare(`
    SELECT name
    FROM sqlite_master
    WHERE type = 'table'
    AND name = 'pages'
  `)
  .get();

if (!hasPagesTable) {
  console.error('');
  console.error('Erreur: la table "pages" n’existe pas.');
  console.error('');
  console.error('Lance d’abord le script de découverte, par exemple:');
  console.error(`node discover-urls-db.js https://example.com output ${DB_FILE}`);
  console.error('');
  process.exit(1);
}

db.exec(`
  CREATE TABLE IF NOT EXISTS crawl_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    db_file TEXT NOT NULL,
    output_dir TEXT NOT NULL,
    docker_image TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS page_crawls (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id INTEGER NOT NULL,
    page_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    ok INTEGER NOT NULL CHECK (ok IN (0, 1)),
    html TEXT,
    markdown TEXT,
    html_file TEXT,
    markdown_file TEXT,
    html_chars INTEGER NOT NULL DEFAULT 0,
    markdown_chars INTEGER NOT NULL DEFAULT 0,
    quality_score INTEGER,
    quality_status TEXT,
    quality_notes TEXT,
    quality_json TEXT,
    error TEXT,
    crawled_at TEXT NOT NULL,
    FOREIGN KEY (run_id) REFERENCES crawl_runs(id),
    FOREIGN KEY (page_id) REFERENCES pages(id)
  );

  CREATE INDEX IF NOT EXISTS idx_page_crawls_run_id ON page_crawls(run_id);
  CREATE INDEX IF NOT EXISTS idx_page_crawls_page_id ON page_crawls(page_id);
  CREATE INDEX IF NOT EXISTS idx_page_crawls_ok ON page_crawls(ok);
  CREATE INDEX IF NOT EXISTS idx_page_crawls_quality_status ON page_crawls(quality_status);
`);

const existingColumns = db
  .prepare(`PRAGMA table_info(page_crawls)`)
  .all()
  .map(column => column.name);

const addColumnIfMissing = (name, sqlType) => {
  if (!existingColumns.includes(name)) {
    db.exec(`ALTER TABLE page_crawls ADD COLUMN ${name} ${sqlType}`);
  }
};

addColumnIfMissing('quality_score', 'INTEGER');
addColumnIfMissing('quality_status', 'TEXT');
addColumnIfMissing('quality_notes', 'TEXT');
addColumnIfMissing('quality_json', 'TEXT');

const insertRun = db.prepare(`
  INSERT INTO crawl_runs (
    started_at,
    db_file,
    output_dir,
    docker_image
  )
  VALUES (?, ?, ?, ?)
`);

const finishRun = db.prepare(`
  UPDATE crawl_runs
  SET finished_at = ?
  WHERE id = ?
`);

const insertCrawl = db.prepare(`
  INSERT INTO page_crawls (
    run_id,
    page_id,
    url,
    ok,
    html,
    markdown,
    html_file,
    markdown_file,
    html_chars,
    markdown_chars,
    quality_score,
    quality_status,
    quality_notes,
    quality_json,
    error,
    crawled_at
  )
  VALUES (
    @run_id,
    @page_id,
    @url,
    @ok,
    @html,
    @markdown,
    @html_file,
    @markdown_file,
    @html_chars,
    @markdown_chars,
    @quality_score,
    @quality_status,
    @quality_notes,
    @quality_json,
    @error,
    @crawled_at
  )
`);

const updatePageAfterCrawl = db.prepare(`
  UPDATE pages
  SET
    last_crawled_at = @last_crawled_at,
    last_crawl_ok = @last_crawl_ok,
    last_error = @last_error,
    updated_at = @updated_at
  WHERE id = @id
`);

const runInfo = insertRun.run(
  nowIso(),
  DB_FILE,
  OUTPUT_DIR,
  IMAGE
);

const runId = Number(runInfo.lastInsertRowid);

const pagesSql = LIMIT > 0
  ? `
      SELECT id, url, title
      FROM pages
      WHERE enabled = 1
      ORDER BY id
      LIMIT ${LIMIT}
    `
  : `
      SELECT id, url, title
      FROM pages
      WHERE enabled = 1
      ORDER BY id
    `;

const pages = db.prepare(pagesSql).all();

console.log(`DB: ${DB_FILE}`);
console.log(`Output dir: ${OUTPUT_DIR}`);
console.log(`Run ID: ${runId}`);
console.log(`Obscura image: ${IMAGE}`);
console.log(`Mode: markdown only`);
console.log(`Enabled URLs to crawl: ${pages.length}`);

let okCount = 0;
let failedCount = 0;
let suspectCount = 0;
let emptyCount = 0;

for (let i = 0; i < pages.length; i++) {
  const page = pages[i];
  const slug = slugFor(page);

  const markdownFile = path.join(markdownDir, `${slug}.md`);

  console.log(`[${i + 1}/${pages.length}] ${page.url}`);

  try {
    const rawMarkdown = await obscuraFetch(page.url, 'markdown');
    const markdown = cleanMarkdown(rawMarkdown);
    const quality = analyzeMarkdownQuality(markdown);

    await writeFile(markdownFile, markdown);

    insertCrawl.run({
      run_id: runId,
      page_id: page.id,
      url: page.url,
      ok: 1,
      html: null,
      markdown,
      html_file: null,
      markdown_file: markdownFile,
      html_chars: 0,
      markdown_chars: markdown.length,
      quality_score: quality.score,
      quality_status: quality.status,
      quality_notes: quality.notes,
      quality_json: JSON.stringify(quality),
      error: null,
      crawled_at: nowIso(),
    });

    updatePageAfterCrawl.run({
      id: page.id,
      last_crawled_at: nowIso(),
      last_crawl_ok: 1,
      last_error: null,
      updated_at: nowIso(),
    });

    okCount += 1;

    if (quality.status === 'suspect') {
      suspectCount += 1;
    }

    if (quality.status === 'empty') {
      emptyCount += 1;
    }

    console.log(
      `  -> ok | status=${quality.status} | score=${quality.score} | raw-md=${rawMarkdown.length} | clean-md=${markdown.length} | notes=${quality.notes || '-'}`
    );
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);

    insertCrawl.run({
      run_id: runId,
      page_id: page.id,
      url: page.url,
      ok: 0,
      html: null,
      markdown: null,
      html_file: null,
      markdown_file: null,
      html_chars: 0,
      markdown_chars: 0,
      quality_score: 0,
      quality_status: 'error',
      quality_notes: 'crawl-error',
      quality_json: null,
      error,
      crawled_at: nowIso(),
    });

    updatePageAfterCrawl.run({
      id: page.id,
      last_crawled_at: nowIso(),
      last_crawl_ok: 0,
      last_error: error,
      updated_at: nowIso(),
    });

    failedCount += 1;

    console.error(`  -> error`);
    console.error(error);
  }
}

finishRun.run(nowIso(), runId);

console.log('');
console.log('Done.');
console.log(`Run ID: ${runId}`);
console.log(`OK: ${okCount}`);
console.log(`Suspect: ${suspectCount}`);
console.log(`Empty: ${emptyCount}`);
console.log(`Failed: ${failedCount}`);
console.log(`SQLite: ${DB_FILE}`);
console.log(`Markdown dir: ${markdownDir}`);

db.close();