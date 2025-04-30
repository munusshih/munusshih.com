// public/scripts/fade-in.js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.batch(".fade-in", {
  interval: 0.2,
  batchMax: 5,
  start: "top 80%",
  once: true,
  onEnter: (batch) => {
    gsap.fromTo(
      batch,
      { y: 30, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 0.6,
        stagger: 0.1,
        ease: "power2.out",
      },
    );
  },
});
