# hoagiestack.com

The public site for Hoagiestack, a Johns & Taylor project. It's a static Astro site in the J&T design language. GitHub Pages serves it, and Cloudflare sits in front for DNS, caching, and Web Analytics.

## Editing

- **Pages:** `src/pages/*.astro`
- **Blog posts:** `src/content/blog/*.md`. Each post's front matter has `title`, an optional `seoTitle` (a shorter title for search results when the headline runs long), `description`, and `order` (its position on /blog). Post images go in `src/assets/blog/`. Astro resizes and compresses them at build time.
- **Booking link, CTA labels, nav, contact email:** `src/site.ts`
- **Colors, type, spacing:** `src/styles/global.css`. The tokens come from `johnsandtaylor-theme/DESIGN-SPECS.md`. Two of them are deliberate deviations, both for contrast. Text-bearing blues use a deeper Hero Blue (`#126fa0` and `#0f6a98`), because white on the brand blue `#1786be` is only 4.05:1, short of J&T's own 4.5:1 rule.

Push to `main` and GitHub Actions builds the site, runs the Reality Check, and deploys. A failing check blocks the deploy.

Post URLs keep the hash suffixes from the old site so existing links and search results still resolve. `build.format: 'file'` keeps `/about`-style URLs, with no trailing-slash redirects.

## Website Reality Check

`tests/reality-check.mjs` turns the ten episodes of J&T's Website Reality Check course into measurable checks. It also runs an axe accessibility scan on every page at phone and desktop widths.

| Episode | What's checked |
| --- | --- |
| 1, 2, 4 Value proposition | One H1 per page, visible without scrolling on a phone, 12 words or fewer on landing pages |
| 3 Mobile | No sideways scroll at 360 and 375px, body text at least 16px, standalone links and buttons at least 44×44px |
| 5 Call to action | A booking button visible without scrolling on every page, on both phone and desktop |
| 6 Trust | Footer names J&T and its location, articles carry a byline, affiliate links are labeled where they appear |
| 7 Navigation | At most 5 nav items, the current section is marked, no broken internal links, and the 404 page offers ways out |
| 8 Contact | Every page offers both booking and email |
| 9 Speed | Lighthouse mobile: performance ≥ 95, accessibility 100, best practices ≥ 95, SEO 100; LCP ≤ 2.5s; CLS ≤ 0.1; page weight ≤ 500 KB; no third-party JavaScript; every image has width, height, and alt |
| 10 Measurement | Every booking link carries `utm_source=hoagiestack.com` and a `utm_content` placement; sitemap and robots.txt are present |

```sh
npm ci
npm run build
npm run check:wrc                     # full run, including Lighthouse
SKIP_LIGHTHOUSE=1 npm run check:wrc   # fast pass (this is what CI runs)
```

Results are written to `reports/reality-check.json`. The tests block the Adobe Fonts kit so results are deterministic. In production, Georgia renders first and Mackinac swaps in once it loads.

## Hosting

- GitHub Pages, deployed by `.github/workflows/deploy.yml`. Settings → Pages → Source must be **GitHub Actions**, and the custom domain must be set to `hoagiestack.com`.
- DNS is at Cloudflare. The apex and `www` point at GitHub Pages, the records are proxied, and SSL/TLS is set to **Full**. Full, not Flexible: Flexible causes redirect loops with GitHub Pages. Full, not strict: the site stays up even if GitHub is late renewing its certificate behind the proxy.
- Email for the domain still runs through Hover. Keep the Hover MX record in Cloudflare DNS.
