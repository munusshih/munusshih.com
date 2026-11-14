import gsap from "gsap";

const motion = matchMedia("(prefers-reduced-motion: no-preference)");
const selector = [
  ".fade-in",
  "body > footer",
  "main > :not(section, .sr-only)",
  "main > section > :not(.grid)",
  "main > section > .grid > *",
].join(", ");

function reveal(elements) {
  if (!motion.matches || elements.length === 0) return;

  const timeline = gsap.timeline();
  elements.forEach((element, index) => {
    element.setAttribute("data-reveal", "");
    timeline.fromTo(element, {
      "--reveal-opacity": 0,
      "--reveal-offset": "24px",
    }, {
      "--reveal-opacity": 1,
      "--reveal-offset": "0px",
      duration: 0.56,
      clearProps: "--reveal-opacity,--reveal-offset",
      onComplete: () => element.removeAttribute("data-reveal"),
      ease: "power3.out",
    }, Math.min(index * 0.06, 0.24));
  });
}

if (motion.matches && "IntersectionObserver" in window) {
  const candidates = Array.from(document.querySelectorAll(selector)).filter(
    (element) => element.getClientRects().length > 0 &&
      !element.closest(".sr-only"),
  );
  const candidatesSet = new Set(candidates);
  const groups = candidates.filter((element) => {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (candidatesSet.has(parent)) return false;
    }
    return true;
  });

  const observer = new IntersectionObserver((entries) => {
    const upcoming = new Set();
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      observer.unobserve(entry.target);
      if (
        entry.target.getBoundingClientRect().top >= window.innerHeight &&
        getComputedStyle(entry.target).opacity === "1"
      ) {
        upcoming.add(entry.target);
      }
    }
    reveal(groups.filter((element) => upcoming.has(element)));
  }, { rootMargin: "0px 0px 80px 0px" });

  for (const element of groups) {
    if (element.getBoundingClientRect().top >= window.innerHeight) {
      observer.observe(element);
    }
  }
}
