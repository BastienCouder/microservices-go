import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';

const URLS_FILE = process.argv[2] ?? 'output/urls.json';
const OUTPUT_DIR = process.argv[3] ?? 'output/content';

const IMAGE = process.env.OBSCURA_IMAGE ?? 'h4ckf0r0day/obscura';

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

function slugFor(item) {
  const title = item.title || titleFromUrl(item.url);
  return `${cleanName(title)}-${hashUrl(item.url)}`;
}

function readUrls(raw) {
  const json = JSON.parse(raw);

  if (!Array.isArray(json)) {
    throw new Error('Le fichier urls.json doit être un tableau');
  }

  return json
    .map(item => {
      if (typeof item === 'string') {
        return { title: '', url: item };
      }

      return {
        title: item.title ?? '',
        url: item.url,
      };
    })
    .filter(item => item.url);
}

function obscuraFetch(url, dumpType, outputFile) {
  return new Promise((resolve, reject) => {
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

    child.stdout.on('data', chunk => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', chunk => {
      stderr += chunk.toString();
    });

    child.on('error', reject);

    child.on('close', async code => {
      if (code !== 0) {
        reject(new Error(stderr || `Obscura exited with code ${code}`));
        return;
      }

      await writeFile(outputFile, stdout);
      resolve();
    });
  });
}

const raw = await readFile(URLS_FILE, 'utf8');
const urls = readUrls(raw);

const htmlDir = path.join(OUTPUT_DIR, 'html');
const markdownDir = path.join(OUTPUT_DIR, 'markdown');

await mkdir(htmlDir, { recursive: true });
await mkdir(markdownDir, { recursive: true });

console.log(`URLs file: ${URLS_FILE}`);
console.log(`Output dir: ${OUTPUT_DIR}`);
console.log(`Obscura Docker image: ${IMAGE}`);
console.log(`URLs: ${urls.length}`);

const manifest = [];

let index = 0;

for (const item of urls) {
  index += 1;

  const slug = slugFor(item);

  const htmlFile = path.join(htmlDir, `${slug}.html`);
  const markdownFile = path.join(markdownDir, `${slug}.md`);

  console.log(`[${index}/${urls.length}] ${item.url}`);

  try {
    await obscuraFetch(item.url, 'html', htmlFile);
    await obscuraFetch(item.url, 'markdown', markdownFile);

    manifest.push({
      ok: true,
      title: item.title,
      url: item.url,
      html: htmlFile,
      markdown: markdownFile,
    });

    console.log(`  -> ok | ${slug}`);
  } catch (err) {
    manifest.push({
      ok: false,
      title: item.title,
      url: item.url,
      error: err instanceof Error ? err.message : String(err),
    });

    console.error(`  -> error`);
    console.error(err instanceof Error ? err.message : String(err));
  }

  await writeFile(
    path.join(OUTPUT_DIR, 'manifest.partial.json'),
    JSON.stringify(manifest, null, 2)
  );
}

await writeFile(
  path.join(OUTPUT_DIR, 'manifest.json'),
  JSON.stringify(manifest, null, 2)
);

console.log('');
console.log('Done.');
console.log(`OK: ${manifest.filter(x => x.ok).length}`);
console.log(`Failed: ${manifest.filter(x => !x.ok).length}`);
console.log(`Manifest: ${path.join(OUTPUT_DIR, 'manifest.json')}`);