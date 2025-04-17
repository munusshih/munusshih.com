import p5 from "p5";

const sketch = (p) => {
  p.setup = () => {
    const parentContainer = p.select("#sketch-container");
    const cnv = p.createCanvas(
      parentContainer.elt.offsetWidth - 1,
      parentContainer.elt.offsetHeight - 1,
    );

    cnv.parent("sketch-container");
    p.pixelDensity(2);
    p.stroke("blue");
    p.strokeWeight(5);
  };

  let lastX;
  let lastY;

  p.draw = () => {
    if (lastX === undefined || lastY === undefined) {
      lastX = p.mouseX;
      lastY = p.mouseY;
    }

    let smoothX = p.lerp(lastX, p.mouseX, 0.1);
    let smoothY = p.lerp(lastY, p.mouseY, 0.1);

    p.line(lastX, lastY, smoothX, smoothY);

    lastX = smoothX;
    lastY = smoothY;
  };

  p.windowResized = () => {
    const parentContainer = p.select("#sketch-container");
    p.resizeCanvas(
      parentContainer.elt.offsetWidth - 1,
      parentContainer.elt.offsetHeight - 1,
    );
  };
};

new p5(sketch);
