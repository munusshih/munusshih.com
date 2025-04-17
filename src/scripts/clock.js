// clockSketch.js
import p5 from "p5";

const sketch = (p) => {
  let clockDiameter;

  p.setup = () => {
    const cnv = p.createCanvas(80, 80);
    cnv.parent("sketch-container");
    clockDiameter = p.width * 0.8;
    p.pixelDensity(2);
    p.frameRate(10);
  };

  p.draw = () => {
    p.clear();

    const centerX = p.width / 2;
    const centerY = p.height / 2;

    p.noFill();
    p.strokeWeight(2);

    let hr = p.hour();
    let mn = p.minute();
    let sc = p.second();

    let secondAngle = p.map(sc, 0, 60, 0, p.TWO_PI) - p.HALF_PI;
    let minuteAngle = p.map(mn, 0, 60, 0, p.TWO_PI) - p.HALF_PI;
    let hourAngle = p.map(hr % 12, 0, 12, 0, p.TWO_PI) - p.HALF_PI;

    // Draw second hand
    p.stroke(0, 0, 255);
    p.line(
      centerX,
      centerY,
      centerX + (p.cos(secondAngle) * clockDiameter) / 2,
      centerY + (p.sin(secondAngle) * clockDiameter) / 2,
    );

    // Draw minute hand
    p.stroke(0);
    p.line(
      centerX,
      centerY,
      centerX + (p.cos(minuteAngle) * clockDiameter) / 2.5,
      centerY + (p.sin(minuteAngle) * clockDiameter) / 2.5,
    );

    // Draw hour hand
    p.stroke(0);
    p.line(
      centerX,
      centerY,
      centerX + (p.cos(hourAngle) * clockDiameter) / 4,
      centerY + (p.sin(hourAngle) * clockDiameter) / 4,
    );

    p.stroke(0);
    p.rect(1, 1, p.width - 2, p.height - 2, 10);
  };
};

new p5(sketch);
