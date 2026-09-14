# Homepage sheet migration

- Started: 2026-09-11
- Migrated to production: 2026-09-14

- Production workbook: `1xjTWCIFYt3wOf0qKDcid2PxkLllHN3cTjkyLnOfDvBE`
- Development workbook: `1YiU0TE5AKzGmDE0J0JrKoP1teNbvsHw-mvC0fAR8gcY`
- Development branch: `codex/homepage-sheet-dev`

The development workbook was the review copy used to test the new controls. The reviewed Homepage, Work Glossary, Writing, Teaching, and Events ranges were migrated to the production workbook on 2026-09-14. Google Sheets version history remains the rollback path for the production workbook.

The new code is backward-compatible:

- Homepage uses `Show` when present and falls back to `On / Off`.
- Homepage `Capture mode` provides `Auto`, `Record`, `Screenshot`, and `OG` controls. `targetName` is the page or asset to capture, while `href` remains the card's click destination.
- Work Glossary creates homepage work cards only when `Feature on homepage` is checked.
- Writing uses checked entries in `Homepage order`; if none are checked, it falls back to the three newest titled entries.
- Teaching uses the explicit `Ongoing` checkbox when present and falls back to semester inference when the column is absent. The development sheet currently checks Technology A, Technology B, Thesis I, Thesis II, and Visual Language B.
- The previous manual homepage work rows remain in the workbook and are disabled only through `Show`.

Production is again the source of truth. Local preview can still use the checked-in YAML snapshots when the production sheet is unavailable; a normal build refreshes those snapshots from the production workbook.

To refresh homepage media from the checked-in snapshot, run `npm run capture:homepage`. `Record` automatically scrolls from the top of the target page, then compresses the recording to a lightweight 960 × 540 WebM; `Screenshot` makes a compressed full-page JPEG; `OG` uses the page's Open Graph image or video. Existing cached captures are replaced only by this explicit refresh command or a force build.
