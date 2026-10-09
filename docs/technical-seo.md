# Technical SEO checks

The canonical site is `https://munusshih.com`, with a trailing slash on content routes. The homepage keeps `/`. Use matching URLs in canonical tags, social URL tags, robots.txt and sitemaps.

Vercel's www and production mirror domain settings must use permanent, path-preserving redirects to the canonical host. `vercel.json` also contains the redirects. Deployment aliases ending in `.vercel.app` receive an `X-Robots-Tag: noindex, follow` header, including immutable production deployment URLs. Preview builds additionally include a robots meta tag. Production's canonical host stays indexable.

The calendar booking utility, decorative pattern sketch and error pages have `noindex` and are excluded from the sitemap. Existing public portfolio pages stay indexable. No future unpublished routes are added. `lastmod` is omitted because the build does not have reliable per-page editorial modification dates.

## Verification

1. Run `npx astro build` to build from the current content sources without running the YAML-writing preparation scripts.
2. Run `npm run test:seo` for canonicalization and video lifecycle behavior.
3. Run `npm run verify:seo`. Optionally pass `--baseline /path/to/original/build --output /path/to/report.json` to compare server-rendered text and descriptions against an original build.
4. For a preview build, run `VERCEL_ENV=preview npx astro build` and `npm run verify:seo -- --preview`.
5. Verify deployed canonical pages return HTTP 200, unknown routes return 404, utility pages are noindex, sitemap URLs return 200, and host/slash redirects are permanent and preserve paths and query strings.
6. Check desktop and mobile rendering. Scroll videos into/out of view; deferred video sources must be attached only when visible, playback must pause offscreen and on hidden tabs, and images must load through the Vercel optimization endpoint. A noscript fallback supplies video controls.

The initial pass checked 27 rendered routes and 24 sitemap URLs, preserved their text and descriptions, deferred 163 video elements across all pages, and supplied dimensions to 79 images. Responsive optimization applies to supported, locally available raster images in the shared Media component. Remote images and animated GIFs retain their original sources.

## Existing follow-up work

Copy-related metadata remains separate: `/ci2` and `/pcd` currently have empty meta descriptions. Several pages have multiple H1 elements from the site header and page sections; this does not block indexing. Some MDX image references have no matching local source asset (for example GOCA image names); do not substitute different artwork without a confirmed mapping. Content loading currently falls back to checked-in Lab data when the configured sheet tab returns 400. Search Console submission, ownership and field Core Web Vitals must be verified in the account; local tests cannot establish them.

## Canonical recovery (2026-10-09)

Search Console URL Inspection confirmed https://munusshih.com/ is indexed and is Google’s selected canonical, discovered through the existing non-www sitemaps. The initial www/no-slash rollout was reversed to preserve that established host and sitemap URL shape. Media improvements remain. The successful Google live fetch of the www sitemap did not establish successful sitemap processing.

## Retired URLs (2026-10-09)

Search Console’s 16 missing URL examples include two retired homepage aliases: /Home and /home. Both map permanently to the homepage. The other 14 belong to the separate tech-a.munusshih.com course deployment (student/week pages); there is no confirmed replacement in the portfolio, so no portfolio redirect is invented. True unknown paths retain HTTP 404.
