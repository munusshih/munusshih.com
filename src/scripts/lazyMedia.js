// Keep autoplay's visual behavior, but load/play only media visible on screen.
const visible = new Set();
const reducedMotion = typeof matchMedia === "function"
  ? matchMedia("(prefers-reduced-motion: reduce)")
  : undefined;

function play(video) {
  if (document.hidden || reducedMotion?.matches) return;
  if (!video.getAttribute("src")) {
    video.src = video.dataset.src;
    video.load();
  }
  video.play()?.catch(() => {});
}

const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const video = entry.target;
    if (entry.isIntersecting) {
      visible.add(video);
      play(video);
    } else {
      visible.delete(video);
      video.pause();
    }
  }
}, { threshold: 0.01 }) : null;

function init() {
  document.querySelectorAll("video[data-lazy-video]").forEach((video) => {
    if (video.dataset.observed) return;
    video.dataset.observed = "true";
    if (observer) observer.observe(video);
    else { visible.add(video); play(video); }
  });
}

function syncPlayback() {
  for (const video of visible) {
    if (document.hidden || reducedMotion?.matches) video.pause();
    else play(video);
  }
}

document.addEventListener("visibilitychange", syncPlayback);
if (reducedMotion?.addEventListener) {
  reducedMotion.addEventListener("change", syncPlayback);
} else {
  reducedMotion?.addListener?.(syncPlayback);
}
document.addEventListener("astro:before-swap", () => {
  observer?.disconnect();
  for (const video of visible) video.pause();
  visible.clear();
});
document.addEventListener("astro:page-load", init);
init();
