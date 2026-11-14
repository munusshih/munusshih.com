export const autoScroll = async (page) => {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await new Promise((resolve) => {
      const distance = 380;
      const delay = 180;
      const maxIterations = 30;
      let iterations = 0;

      const timer = setInterval(() => {
        const maxScroll =
          Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
          ) - window.innerHeight;

        window.scrollBy(0, distance);
        iterations += 1;

        if (window.scrollY >= maxScroll || iterations >= maxIterations) {
          clearInterval(timer);
          resolve();
        }
      }, delay);
    });
  });
};

async function scrollForVideo(page) {
  await page.evaluate(async () => {
    const root = document.scrollingElement;
    if (!root) return;
    const distance = Math.min(11_400, root.scrollHeight - window.innerHeight);
    if (distance <= 0) return;

    const duration = Math.max(2_000, (distance / 700) * 1000);
    const started = performance.now();
    await new Promise((resolve) => {
      function advance(now) {
        const progress = Math.min((now - started) / duration, 1);
        const eased = progress - Math.sin(2 * Math.PI * progress) / (8 * Math.PI);
        window.scrollTo({ top: distance * eased, behavior: "instant" });
        if (progress < 1) requestAnimationFrame(advance);
        else resolve();
      }
      requestAnimationFrame(advance);
    });
  });
}

export async function recordSiteScroll(browser, url, directory, options = {}) {
  const viewport = { width: 1280, height: 720 };
  const context = await browser.newContext({
    viewport,
    userAgent: options.userAgent,
    colorScheme: options.colorScheme ?? "light",
    recordVideo: { dir: directory, size: viewport },
  });
  let video;
  let readyAt = 0;

  try {
    const startedAt = performance.now();
    const page = await context.newPage();
    const response = await page.goto(url, {
      waitUntil: options.waitUntil ?? "networkidle",
      timeout: options.timeout ?? 90_000,
    });
    if (options.prepare) await options.prepare(page, response);
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    readyAt = (performance.now() - startedAt) / 1000;
    // Leave a short hold after the cut so the opening view is visible.
    if (options.trimLoading) await page.waitForTimeout(800);
    await scrollForVideo(page);
    await page.waitForTimeout(1700);
    video = page.video();
  } finally {
    await context.close();
  }

  if (!video) throw new Error(`No video file recorded for ${url}`);
  return {
    path: await video.path(),
    startTime: options.trimLoading ? readyAt : 0,
  };
}
