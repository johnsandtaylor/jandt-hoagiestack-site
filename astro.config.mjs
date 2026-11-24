// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

/** Markdown clean-up for blog posts:
 *  - wrap tables in a focusable, labelled scroll box so wide tables scroll on phones
 *    instead of pushing the page sideways;
 *  - mark affiliate links rel="sponsored" and label them right where they appear;
 *  - tag booking links with UTM parameters so bookings can be traced to articles. */
function rehypePostCleanup() {
  return (/** @type {any} */ tree) => {
    let tables = 0;
    /** @param {any} node */
    const walk = (node) => {
      if (!node.children) return;
      const out = [];
      for (const child of node.children) {
        walk(child);
        if (child.type === 'element' && child.tagName === 'table') {
          tables += 1;
          out.push({
            type: 'element',
            tagName: 'div',
            properties: { className: ['table-wrap'], tabIndex: 0, role: 'region', ariaLabel: `Table ${tables} (scrolls sideways on small screens)` },
            children: [child],
          });
          continue;
        }
        if (child.type === 'element' && child.tagName === 'a' && typeof child.properties?.href === 'string') {
          const href = child.properties.href;
          if (href.includes('partners.kit.com')) {
            child.properties.rel = ['sponsored', 'noopener'];
            out.push(child, { type: 'text', value: ' (affiliate link)' });
            continue;
          }
          if (href.includes('savvycal.com/joetaylorjr/jt-hoagiestack-discovery-call') && !href.includes('utm_')) {
            child.properties.href = `${href}${href.includes('?') ? '&' : '?'}utm_source=hoagiestack.com&utm_medium=website&utm_content=article`;
          }
        }
        out.push(child);
      }
      node.children = out;
    };
    walk(tree);
  };
}

export default defineConfig({
  site: 'https://hoagiestack.com',
  // Emit about.html instead of about/index.html so GitHub Pages serves
  // /about with no redirect, matching the URLs the old site used.
  build: { format: 'file', inlineStylesheets: 'always' },
  trailingSlash: 'never',
  integrations: [sitemap()],
  markdown: { rehypePlugins: [rehypePostCleanup] },
});
