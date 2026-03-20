# Website Structure Audit (March 2026)

## Current Structure Snapshot
- Rendering: Astro static site with mixed page types (`.astro`, one custom sketch page, MDX work detail pages).
- Content sources:
  - `src/content/work/*.mdx` for work detail pages.
  - Sheet-synced YAML in `src/docs/*.yml` for list/homepage/teaching data.
  - Generated manifests in `src/data/generated/*.json` for cached media.
- Media source of truth: `src/assets`, served via `public/assets` symlink.
- Build pipeline: sync sheet data -> cache media -> generate posters -> generate OG images -> build.

## What Is Working Well
- Strong static-first architecture (fast runtime, cacheable output).
- Clear separation between authored content (`src/content`) and generated data (`src/data/generated`).
- Build now enforces per-page unique OG images and work-page low-res OG previews.

## Main Risks / Friction
- Build complexity is high (multiple scripts with external network dependencies).
- Sheet tab failures (`400`) are noisy and easy to miss among build logs.
- Media generation is expensive when forced, and there are many moving parts.
- Metadata/SEO logic is distributed across several pages/layouts.

## Recommendations (Prioritized)
1. Add a build health gate for content tabs:
   - Fail build in CI if required tabs are missing, instead of only warning.
2. Add a single "content pipeline report" JSON artifact:
   - Record sync/cache counts, skipped items, and failures from each script.
3. Add automated link/media checks in CI:
   - Verify all rendered `og:image`, `src`, and `poster` URLs exist in `dist`.
4. Keep `dev` and `dev:instant` split:
   - `dev` for safe incremental refresh.
   - `dev:instant` for rapid UI iteration.
5. Consolidate metadata config:
   - Keep route-to-OG mapping in one generated manifest to avoid page-level duplication.

## Do You Need a CMS?
Short answer: **probably yes if you’ll keep scaling content + collaborators**.

### If you stay with Google Sheets
- Keep as-is for quick edits.
- Add strict schema validation and required-tab checks to reduce silent failures.
- Keep media in `src/assets` and avoid direct external media dependencies where possible.

### If you migrate to a CMS (recommended direction)
- Best fit here: **Sanity** (good media pipeline, structured schema, editor-friendly, flexible API).
- Good alternatives: Contentful (strong editorial UX), Strapi (self-hosted control).
- Migration scope:
  - Move homepage/teaching/events/press/commons from Sheets to CMS collections.
  - Keep work MDX in repo initially, or migrate later in phase 2.
  - Replace sheet-sync scripts with a single typed fetch step during build.

## Suggested Migration Path (Low Risk)
1. Phase 1: Keep existing site, add CMS for one dataset first (e.g., homepage cards).
2. Phase 2: Move teaching/events/press.
3. Phase 3: Optionally migrate work detail content from MDX if editorial needs grow.
4. Phase 4: remove sheet-sync scripts once parity is confirmed.

