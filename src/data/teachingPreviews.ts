type Preview = { src: string; kind: "image" | "video"; caption?: string };

export const teachingPreviews: Record<string, Preview[]> = {
  "CSS Magic! Transition, Transform and Animation": [
    { src: "/teaching-previews/css-magic.webp", kind: "image", caption: "CSS Magic workshop notes" },
  ],
  "*New* Graphic Design: Program, Data, Custom Algorithm": [
    { src: "/teaching-previews/graphic-design.webp", kind: "image", caption: "Opening slide from the Graphic Design workshop" },
  ],
  "p5.book for Zine Making for the Web": [
    { src: "/research/p5-book/workshop-book-size.webp", kind: "image", caption: "Choosing a book size in p5.book" },
    { src: "/research/p5-book/editor-flipbook.gif", kind: "image", caption: "An alphabet zine in the p5.js editor" },
  ],
  "p5.book": [
    { src: "/research/p5-book/flipbook-viewer-spread.webp", kind: "image", caption: "A spread in the p5.book viewer" },
  ],
  "p5.book: Open Source Publish, Publish Open Source": [
    { src: "/research/pcd-taiwan/new-neighbors-p5-book-workshop.webp", kind: "image", caption: "The p5.book workshop at New Neighbors" },
  ],
  "p5.book: A Generative Approach to Book-making": [
    { src: "/research/p5-book/parametric-flipbook.webp", kind: "image", caption: "A printed parametric flipbook" },
    { src: "/research/p5-book/workshop-recording.webm", kind: "video", caption: "A walkthrough of the p5.book workshop materials" },
  ],
};
