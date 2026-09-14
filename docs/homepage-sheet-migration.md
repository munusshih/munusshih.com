# Homepage sheet development migration

Date: 2026-09-11

- Production workbook: `1xjTWCIFYt3wOf0qKDcid2PxkLllHN3cTjkyLnOfDvBE`
- Development workbook: `1YiU0TE5AKzGmDE0J0JrKoP1teNbvsHw-mvC0fAR8gcY`
- Development branch: `codex/homepage-sheet-dev`

The production workbook is the rollback source and was not edited. The development workbook is a complete Drive copy made before the migration.

The new code is backward-compatible:

- Homepage uses `Show` when present and falls back to `On / Off`.
- Work Glossary creates homepage work cards only when `Feature on homepage` is checked.
- Writing uses checked entries in `Homepage order`; if none are checked, it falls back to the three newest titled entries.
- Teaching uses the explicit `Ongoing` checkbox when present and falls back to semester inference when the column is absent. The development sheet currently checks Technology A, Technology B, Thesis I, Thesis II, and Visual Language B.
- The previous manual homepage work rows remain in the workbook and are disabled only through `Show`.

The development workbook is private, so local preview uses the checked-in YAML snapshots. Before production migration, apply the reviewed development ranges to the production workbook, remove the development-only data override, and verify the live OpenSheet reads before deployment.
