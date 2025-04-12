import gsap from "gsap";
import Lenis from "lenis";

const lenis = new Lenis({
  autoRaf: true,
});

// window.addEventListener("load", () => {
//   gsap.fromTo(
//     ".gsap-element", // Target all elements with the class "gsap-element"
//     {
//       opacity: 0, // Start fully transparent
//       y: () => `${-Math.random() * 10 + 10}px`, // Randomize starting Y position between -10px and -100px
//       scale: 0.95, // Start slightly scaled down
//       rotation: () => Math.random() * 10 - 5, // Random rotation between -5deg and 5deg
//     },
//     {
//       opacity: 1, // End fully opaque
//       y: "0%", // Move to the normal position (fully visible)
//       scale: 1, // Return to the normal scale
//       rotation: 0, // End with no rotation
//       duration: 1.2, // Duration of the animation for smoothness
//       stagger: {
//         amount: 0.6, // Spread stagger duration over more time (to create a wave-like effect)
//         from: "start", // Stagger from the first element
//         ease: "power4.out", // Smooth easing for the stagger
//       },
//       ease: "power4.out", // Smooth easing for individual element animation
//     },
//   );
// });
