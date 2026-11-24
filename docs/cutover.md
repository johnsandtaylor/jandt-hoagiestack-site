# Cutover: Vercel + Hover DNS → GitHub Pages + Cloudflare

Snapshot of DNS before the cutover (checked 2026-11-24):

| Record | Value | What it is |
| --- | --- | --- |
| NS | ns1.hover.com, ns2.hover.com | Hover runs DNS |
| A `@` | 216.198.79.1 | Vercel (old site) |
| CNAME `www` | cname.vercel-dns.com | Vercel (old site) |
| MX `@` | 10 mx.hover.com.cust.hostedemail.com | **Hover email: keep** |
| CNAME `mail` | mail.hover.com.cust.hostedemail.com | **Hover webmail: keep** |

DNS lookups can't list every record in a zone. Before you start, open Hover's DNS page for hoagiestack.com and note anything not in this table.

## 1. GitHub: claim the domain first

GitHub recommends adding the domain to Pages before pointing DNS at it. This closes the window where someone else could claim it.

1. *(Recommended)* Go to Org settings → Pages → **Add a domain** → `hoagiestack.com`. GitHub shows a TXT record (`_github-pages-challenge-johnsandtaylor`). Add it in step 2 and click Verify once DNS is live.
2. Go to Repo → Settings → Pages → Custom domain: `hoagiestack.com` → Save. The DNS check fails until step 3. That's expected.

## 2. Cloudflare: build the zone

1. Add a site: `hoagiestack.com`, Free plan. Let it scan for existing records.
2. In DNS, **delete** the Vercel records: A `@ 216.198.79.1` and CNAME `www → cname.vercel-dns.com`.
3. **Add** the GitHub Pages records. Set them to **DNS only (grey cloud)** for now. GitHub can't issue its HTTPS certificate while Cloudflare is proxying.
   - A `@`: 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
   - AAAA `@`: 2606:50c0:8000::153, 2606:50c0:8001::153, 2606:50c0:8002::153, 2606:50c0:8003::153
   - CNAME `www` → `johnsandtaylor.github.io`
4. **Keep** the MX and the `mail` CNAME exactly as they are, DNS only, plus anything extra you found on Hover's DNS page.
5. Under SSL/TLS → Overview, set the mode to **Full**. Under Edge Certificates, turn on **Always Use HTTPS**.

## 3. Hover: switch nameservers

1. If DNSSEC is on at Hover, turn it off first.
2. Replace ns1/ns2.hover.com with the two nameservers Cloudflare assigned.
3. Wait for Cloudflare to show the zone as **Active**. This usually takes minutes, and can take up to 24 hours.

## 4. GitHub: HTTPS

1. Go to Repo → Settings → Pages. Wait for the DNS check to pass and the certificate to issue. This can take up to 24 hours, though it's usually much faster.
2. Tick **Enforce HTTPS**.
3. Check https://hoagiestack.com and https://www.hoagiestack.com. Both should show the new site.

## 5. Cloudflare: turn on the proxy and analytics

1. Switch the apex A, AAAA and `www` records to **Proxied (orange cloud)**.
2. Go to Analytics & Logs → Web Analytics and enable it for hoagiestack.com. Proxied sites can use the automatic setup, which needs no code changes.
3. Run `curl -sI https://hoagiestack.com` and confirm the response shows `server: cloudflare` and `HTTP/2 200`.

## 6. Clean up

- Send a test email to and from your hoagiestack.com address to confirm Hover mail still works.
- Remove hoagiestack.com from the Vercel project, then pause or delete the project. Cancel Marblism if nothing else uses it.
- Adobe Fonts → Web Projects → kit `gxu3pkm`: make sure `hoagiestack.com` is on the kit's domain list. If it isn't, the site falls back to Georgia.
- SavvyCal: confirm that booking links' `utm_content` values (home-hero, header, alternatives, article…) show up with the bookings.

## Rollback

Until the Hover nameservers change, nothing is live. After the change, put the Vercel records back in Cloudflare (A `@ 216.198.79.1`, CNAME `www → cname.vercel-dns.com`). As long as the Vercel project still exists, the old site comes straight back.
