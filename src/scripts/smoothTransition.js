import Lenis from "lenis";

const lenis = new Lenis({
  autoRaf: true,
});

const navToggle = document.getElementById("nav-toggle");
navToggle.addEventListener("change", () => {
  if (navToggle.checked) {
    lenis.stop(); // ✨ Pause smooth scroll
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  } else {
    lenis.start(); // ✨ Resume smooth scroll
    document.body.style.overflow = "";
    document.documentElement.style.overflow = "";
  }
});
