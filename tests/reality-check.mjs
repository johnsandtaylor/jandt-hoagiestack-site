// Website Reality Check, as automated tests.
//
// Maps the ten episodes of J&T's "Website Reality Check" course onto checks that can be
// measured against the built site, plus the accessibility rules in johnsandtaylor-theme/DESIGN-SPECS.md.
//
//   npm run build && npm run check:wrc            (all checks, including Lighthouse)
//   SKIP_LIGHTHOUSE=1 npm run check:wrc           (fast pass, no Lighthouse)
//
// Serves ./dist the way GitHub Pages does (/about -> about.html, unknown -> 404.html).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = await import('playwright')); } catch { ({ chromium } = require('playwright')); }
const { default: AxeBuilder } = await import('@axe-core/playwright');

const DIST = path.resolve('dist');
const PORT = 4791;
const ORIGIN = `http://localhost:${PORT}`;
const MOBILE = { width: 375, height: 667 };
const NARROW = { width: 360, height: 740 };
const DESKTOP = { width: 1366, height: 768 };

// ---------- static server that behaves like GitHub Pages ----------
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.xml': 'application/xml', '.txt': 'text/plain' };
function resolve(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const candidates = [clean, clean + '.html', path.join(clean, 'index.html')];
  for (const c of candidates) {
    const f = path.join(DIST, c);
    if (f.startsWith(DIST) && fs.existsSync(f) && fs.statSync(f).isFile()) return f;
  }
  return null;
}
const server = http.createServer((req, res) => {
  const f = resolve(req.url);
  if (!f) { res.writeHead(404, { 'content-type': types['.html'] }); return res.end(fs.readFileSync(path.join(DIST, '404.html'))); }
  res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'public, max-age=600' });
  res.end(fs.readFileSync(f));
});
await new Promise((r) => server.listen(PORT, r));

// ---------- pages under test (from the sitemap, plus the 404) ----------
const sitemap = fs.readFileSync(path.join(DIST, 'sitemap-0.xml'), 'utf8');
const pages = [...sitemap.matchAll(/<loc>https:\/\/hoagiestack\.com([^<]*)<\/loc>/g)].map((m) => m[1] || '/');
pages.push('/this-page-does-not-exist');

const results = [];
const record = (page, check, pass, detail = '') => results.push({ page, check, pass, detail });

const browser = await chromium.launch();

async function open(viewport, url) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  // Keep tests local and deterministic: block third-party font CSS (Georgia fallback is what first paint uses anyway).
  await page.route(/typekit\.net/, (r) => r.abort());
  const resp = await page.goto(ORIGIN + url, { waitUntil: 'load' });
  return { ctx, page, status: resp.status() };
}

const BOOKING = 'a[href*="savvycal.com/joetaylorjr/jt-hoagiestack-discovery-call"]';
const internalLinks = new Set();

for (const url of pages) {
  const is404 = url === '/this-page-does-not-exist';

  // ----- mobile -----
  {
    const { ctx, page, status } = await open(MOBILE, url);
    record(url, 'Page loads', is404 ? status === 404 : status === 200, `HTTP ${status}`);

    // Ep 1, 2, 4 — clear value proposition within 5 seconds: one H1, visible without scrolling
    const h1 = await page.$$eval('h1', (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { text: e.textContent.trim(), top: r.top, bottom: r.bottom }; }));
    record(url, 'Ep4 Exactly one H1', h1.length === 1, `${h1.length} found`);
    if (h1[0]) record(url, 'Ep4 H1 visible above the fold (mobile)', h1[0].bottom <= MOBILE.height, `bottom ${Math.round(h1[0].bottom)}px`);
    if (h1[0] && !url.startsWith('/blog/')) record(url, 'Ep4 H1 is short enough to read at a glance (≤ 12 words)', h1[0].text.split(/\s+/).length <= 12, `${h1[0].text.split(/\s+/).length} words`);

    // Ep 5 — a primary call to action visible without scrolling
    const ctaAbove = await page.$$eval(BOOKING, (els, h) => els.some((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.height > 0 && r.top >= 0 && r.bottom <= h && s.visibility !== 'hidden'; }), MOBILE.height);
    record(url, 'Ep5 Booking CTA visible above the fold (mobile)', ctaAbove);

    // Ep 3 — mobile: no sideways scroll at 375px, readable text, touch targets
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    record(url, 'Ep3 No horizontal scroll at 375px', overflow <= 0, `${overflow}px overflow`);
    const bodySize = await page.$eval('body', (b) => parseFloat(getComputedStyle(b).fontSize));
    record(url, 'Ep3 Body text ≥ 16px on mobile', bodySize >= 16, `${bodySize}px`);
    const smallTargets = await page.$$eval('header a, footer a, .btn, .card__link, .back-link, .sources a, nav a', (els) =>
      // Links inside running text are exempt (WCAG 2.5.8 inline exception); everything standalone must be 44×44.
      els.filter((e) => !(e.closest('p') && !e.matches('.btn, .card__link, .back-link'))).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.height < 44 || r.width < 44); }).map((e) => `${e.textContent.trim().slice(0, 30)} (${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)})`));
    record(url, 'Ep3 Standalone links and buttons ≥ 44×44px', smallTargets.length === 0, smallTargets.join('; '));

    // Accessibility (J&T spec + WCAG 2.2 AA) via axe, at mobile width
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    record(url, 'A11y axe: zero violations (mobile)', axe.violations.length === 0, axe.violations.map((v) => `${v.id} ×${v.nodes.length}`).join(', '));

    await ctx.close();
  }

  // ----- narrow phone -----
  {
    const { ctx, page } = await open(NARROW, url);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    record(url, 'Ep3 No horizontal scroll at 360px', overflow <= 0, `${overflow}px overflow`);
    await ctx.close();
  }

  // ----- desktop -----
  {
    const { ctx, page } = await open(DESKTOP, url);
    const ctaAbove = await page.$$eval(BOOKING, (els, h) => els.some((e) => { const r = e.getBoundingClientRect(); return r.height > 0 && r.top >= 0 && r.bottom <= h; }), DESKTOP.height);
    record(url, 'Ep5 Booking CTA visible above the fold (desktop)', ctaAbove);

    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice']).analyze();
    record(url, 'A11y axe: zero violations (desktop)', axe.violations.length === 0, axe.violations.map((v) => `${v.id} ×${v.nodes.length}`).join(', '));

    // Skip link works and is first focusable element
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() => document.activeElement?.className || '');
    record(url, 'A11y Skip link is first in tab order', firstFocus.includes('skip-link'), firstFocus);

    // Ep 7 — navigation: few, plain labels; current page marked
    const navCount = await page.$$eval('nav[aria-label="Primary"] li:not(.nav-cta) a', (els) => els.length);
    record(url, 'Ep7 Primary nav has ≤ 5 items', navCount <= 5, `${navCount} items`);
    const navPaths = await page.$$eval('nav[aria-label="Primary"] li:not(.nav-cta) a', (els) => els.map((e) => e.getAttribute('href')));
    const section = navPaths.find((p) => url === p || url.startsWith(p + '/'));
    if (section) {
      const current = await page.$eval(`nav[aria-label="Primary"] a[href="${section}"]`, (e) => e.getAttribute('aria-current'));
      record(url, 'Ep7 Current section marked in nav', current === 'page');
    }

    // Ep 6 — trust signals: who's behind it, how to reach them, disclosed affiliate links
    const footer = await page.$eval('footer', (f) => f.textContent);
    record(url, 'Ep6 Footer names the agency and location', /Johns & Taylor/.test(footer) && /Collingswood/.test(footer));
    const affiliate = await page.$$eval('a[href*="partners.kit.com"]', (els) => els.map((e) => /affiliate/i.test(e.closest('p, li, td, article')?.textContent || '')));
    if (affiliate.length) record(url, 'Ep6 Affiliate links disclosed next to the link', affiliate.every(Boolean));
    if (url.startsWith('/blog/')) {
      const byline = await page.$eval('article header', (h) => h.textContent);
      record(url, 'Ep6 Article has a named author', /Joe Taylor Jr\./.test(byline));
    }

    // Ep 8 — contact: every page offers both booking and email
    const hasMail = await page.$$eval('a[href^="mailto:"]', (els) => els.length > 0);
    const bookings = await page.$$eval(BOOKING, (els) => els.map((e) => e.href));
    record(url, 'Ep8 Page offers booking and email contact', hasMail && bookings.length > 0);

    // Ep 10 — measurement: every booking link says where it was clicked
    const untagged = bookings.filter((h) => !/utm_source=hoagiestack\.com/.test(h) || !/utm_content=/.test(h));
    record(url, 'Ep10 Booking links carry UTM source + placement', untagged.length === 0, untagged.join(' '));

    // SEO basics that help people find and trust the page
    const meta = await page.evaluate(() => ({
      title: document.title,
      desc: document.querySelector('meta[name="description"]')?.content || '',
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      og: document.querySelector('meta[property="og:image"]')?.content || '',
    }));
    record(url, 'SEO Title ≤ 65 chars', meta.title.length <= 65, `${meta.title.length}: ${meta.title}`);
    record(url, 'SEO Meta description 70–160 chars', meta.desc.length >= 70 && meta.desc.length <= 160, `${meta.desc.length}`);
    if (!is404) record(url, 'SEO Canonical URL matches page', meta.canonical === `https://hoagiestack.com${url === '/' ? '/' : url}`, meta.canonical);
    record(url, 'SEO Social share image set', !!meta.og);

    // Ep 9 — speed/stability: no external scripts; images sized to prevent layout shift
    const extScripts = await page.$$eval('script[src]', (els) => els.map((e) => e.src));
    record(url, 'Ep9 No third-party JavaScript', extScripts.length === 0, extScripts.join(' '));
    const unsized = await page.$$eval('img', (els) => els.filter((i) => !i.getAttribute('width') || !i.getAttribute('height') || !i.getAttribute('alt')).map((i) => i.src));
    record(url, 'Ep9 Images have width, height and alt', unsized.length === 0, unsized.join(' '));

    for (const href of await page.$$eval('a[href^="/"]', (els) => els.map((e) => e.getAttribute('href')))) internalLinks.add(href.split('#')[0]);
    await ctx.close();
  }
}

// Ep 7 — no dead ends: every internal link resolves
for (const href of internalLinks) {
  const ok = !!resolve(href);
  if (!ok) record(href, 'Ep7 Internal link resolves', false, 'broken');
}
record('(site)', 'Ep7 All internal links resolve', [...internalLinks].every((h) => !!resolve(h)), `${internalLinks.size} unique links`);
record('(site)', 'Ep10 sitemap + robots.txt present', fs.existsSync(path.join(DIST, 'sitemap-index.xml')) && fs.existsSync(path.join(DIST, 'robots.txt')));

await browser.close();

// ---------- Ep 9: Lighthouse, mobile, simulated slow 4G ----------
if (!process.env.SKIP_LIGHTHOUSE) {
  const { default: lighthouse } = await import('lighthouse');
  const chromeLauncher = await import('chrome-launcher');
  const chrome = await chromeLauncher.launch({ chromePath: chromium.executablePath(), chromeFlags: ['--headless=new', '--no-sandbox'] });
  const min = { performance: 0.95, accessibility: 1, 'best-practices': 0.95, seo: 1 };
  for (const url of pages.filter((p) => !p.startsWith('/this-page'))) {
    const { lhr } = await lighthouse(ORIGIN + url, { port: chrome.port, output: 'json', logLevel: 'error', blockedUrlPatterns: ['*typekit.net*'] });
    for (const [cat, floor] of Object.entries(min)) {
      const score = lhr.categories[cat].score;
      record(url, `Ep9 Lighthouse ${cat} ≥ ${floor * 100}`, score >= floor, `${Math.round(score * 100)}`);
    }
    const lcp = lhr.audits['largest-contentful-paint'].numericValue;
    const cls = lhr.audits['cumulative-layout-shift'].numericValue;
    const weight = lhr.audits['total-byte-weight'].numericValue;
    record(url, 'Ep9 LCP ≤ 2.5s (mobile, slow 4G)', lcp <= 2500, `${Math.round(lcp)}ms`);
    record(url, 'Ep9 CLS ≤ 0.1', cls <= 0.1, cls.toFixed(3));
    record(url, 'Ep9 Page weight ≤ 500 KB', weight <= 500 * 1024, `${Math.round(weight / 1024)} KB`);
  }
  await chrome.kill();
}

server.close();

// ---------- report ----------
const failed = results.filter((r) => !r.pass);
const byPage = {};
for (const r of results) (byPage[r.page] ||= []).push(r);
for (const [page, rs] of Object.entries(byPage)) {
  const bad = rs.filter((r) => !r.pass);
  console.log(`${bad.length ? '✗' : '✓'} ${page}  (${rs.length - bad.length}/${rs.length})`);
  for (const r of bad) console.log(`    ✗ ${r.check}${r.detail ? ` — ${r.detail}` : ''}`);
}
fs.mkdirSync('reports', { recursive: true });
fs.writeFileSync('reports/reality-check.json', JSON.stringify(results, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
process.exit(failed.length ? 1 : 0);
