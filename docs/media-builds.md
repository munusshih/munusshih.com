# Media generation during builds

`npm run build` syncs the spreadsheet, generates Teaching and Homepage media,
generates posters and OG images, links assets, then builds Astro. Local and Vercel
builds share `prepare:build:media` so neither skips generation.

Vercel first runs `scripts/prepareBuildMedia.js` to install Chromium and its Linux
dependencies and check screenshots, video recording, ffmpeg and ffprobe. A missing
build tool fails the build before capture scripts can fall back to old media.
The Amazon Linux branch uses `dnf`; Playwright's standard Linux dependency installer
supports Ubuntu/Debian instead.

Normal builds reuse existing captures and generate missing files. For example,
adding `[video] https://class.playhtml.fun/` to a Teaching media column creates a
recording before the Teaching manifest is consumed by Astro. External sites may
still reject capture; the generators log failures and try their existing fallbacks.
Builds are longer when new media needs recording.

`npm run build:force` replaces existing captures too. Existing captures with the
same filenames are reused on a normal build, even if the source page changes.

References: [Vercel build image](https://vercel.com/docs/builds/build-image) and
[Playwright browsers](https://playwright.dev/docs/browsers).
