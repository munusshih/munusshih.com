// public/scripts/fade-in.js
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

ScrollTrigger.batch(".fade-in", {
  interval: 0.2,
  batchMax: 5,
  onEnter: (batch) => {
    gsap.fromTo(
      batch,
      {
        opacity: 0,
      },
      {
        opacity: 1,
        duration: 0.3,
        stagger: 0.05,
        ease: "sine.out",
      },
    );
  },
  start: "top 85%",
  once: true,
});
