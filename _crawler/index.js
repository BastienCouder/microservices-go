import puppeteer from 'puppeteer-core';

const browser = await puppeteer.connect({
  browserWSEndpoint: 'ws://127.0.0.1:9222/devtools/browser',
});

const page = await browser.newPage();
await page.goto('https://tailwindcss.com');

const data = await page.evaluate(() =>
  Array.from(document.querySelectorAll('a'))
    .map(a => ({
      text: a.textContent?.trim(),
      url: a.href
    }))
    .filter(x => x.text && x.url)
);

console.log(data);

await browser.disconnect();