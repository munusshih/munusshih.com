import Lenis from "lenis";

if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
  const lenis = new Lenis({ autoRaf: true });
  const menu = document.querySelector("#nav-toggle");
  menu?.addEventListener("change", () => {
    if (menu.checked) lenis.stop();
    else lenis.start();
  });
}
