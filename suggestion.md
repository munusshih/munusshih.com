# Website Structure Audit (March 2026)

## Teaching
- to redesign the teaching page to be more like a portfolio of past courses, with student works, selected lectures. Also design it like a pullout card system. it should be:
- ongoing
- past classes
- workshops
- each of them is a separate card that's expandable

## Work
- to redesign work to feature
"selected works"
and "recent works"
and "archives"

each work should also function like a card with color

- to add a "work in progress" tag for works that are still being developed, and to feature them in a separate section on the homepage.
- integrate maybe a cms for this, or at least a google sheet, to make it easier to update and maintain the work pages without needing to edit code directly.

## Commons
- all my collaborators, community efforts, my services as well. Talks, events, press, tools, open source projects. People I work with, and the things we do together. This is the "commons" that I contribute to and am a part of.
- More like a network view. Each circle is a web ring.
- make sure this is very easy to update in google sheets as well

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

