// public/scripts/fade-in.js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

document.addEventListener("DOMContentLoaded", () => {
  ScrollTrigger.batch(".fade-in", {
    onEnter: (batch) => {
      gsap.fromTo(
        batch,
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          duration: 1,
          stagger: 0.2,
          ease: "power2.out",
        },
      );
    },
    start: "top 85%",
    once: true,
  });
});
