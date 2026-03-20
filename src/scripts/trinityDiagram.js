import p5 from "p5";

const sketches = new WeakMap();

function createTrinitySketch(container) {
  const sketch = (p) => {
    const DIAGRAM_ASPECT = 0.96;
    let resizeObserver = null;
    let width = 0;
    let height = 0;
    let centerX = 0;
    let centerY = 0;
    let triangleRadius = 0;
    let outerNodeRadius = 0;
    let centerNodeRadius = 0;
    let bandWidth = 0;
    let nodeStrokeWidth = 0;
    let focal = 0;
    let nodeLabelSize = 0;
    let edgeLabelSize = 0;
    let outerDepth = 0;
    let centerDepth = 0;
    let nodeTextDepthShift = 0;
    let munusDrift = 0;
    let pointerX = 0;
    let pointerY = 0;

    const nodeLabels = {
      software: "Software",
      commons: "Commons",
      community: "Community",
      munus: "Munus",
    };

    const edgeDefs = [
      {
        from: "software",
        to: "commons",
        text: "Open Source, Tutorials, Tools",
        speed: 0.9,
      },
      {
        from: "commons",
        to: "community",
        text: "Solidarity Economy, Collective Publishing, Cooperatives",
        speed: 0.75,
      },
      {
        from: "community",
        to: "software",
        text: "Databases, Infrastructure, World-building",
        speed: 0.85,
      },
      {
        from: "munus",
        to: "software",
        text: "Develop, Research, Hack",
        speed: 0.44,
      },
      {
        from: "munus",
        to: "commons",
        text: "Publish, Archive, Distribute",
        speed: 0.39,
      },
      {
        from: "munus",
        to: "community",
        text: "Organize, Facilitate, Collaborate",
        speed: 0.42,
      },
    ];

    function recalc() {
      const containerWidth = Math.max(
        220,
        Math.round(container.clientWidth || 360),
      );
      width = containerWidth;
      height = Math.round(width * DIAGRAM_ASPECT);
      p.resizeCanvas(width, height);

      centerX = width / 2;
      centerY = height * 0.45;

      outerNodeRadius = width * 0.125;
      centerNodeRadius = outerNodeRadius * 0.93;
      bandWidth = width * 0.15;
      nodeStrokeWidth = width * 0.0048;

      const margin = width * 0.045;
      const maxByTop = 2 * (centerY - outerNodeRadius - margin);
      const maxByBottom = height - outerNodeRadius - margin - centerY;
      const maxBySides = (centerX - outerNodeRadius - margin) / 0.866;
      const availableRadius = Math.min(maxByTop, maxByBottom, maxBySides);
      const targetRadius = width * 0.4;
      triangleRadius = Math.min(targetRadius, availableRadius);

      focal = width * 2;
      nodeLabelSize = width * 0.04;
      edgeLabelSize = width * 0.05;
      outerDepth = width * 0.04;
      centerDepth = width * 0.022;
      nodeTextDepthShift = width * 0.0042;
      munusDrift = width * 0.0045;
    }

    function projectPoint(x, y, z) {
      const scale = focal / (focal - z);
      return {
        x: centerX + (x - centerX) * scale,
        y: centerY + (y - centerY) * scale,
        scale,
        z,
      };
    }

    function currentNodes() {
      const t = p.frameCount;
      const rotation = 0.06 * Math.sin(t * 0.014) + pointerX * 0.14;
      const breath = 1 + 0.02 * Math.sin(t * 0.02);
      const r = triangleRadius * breath;
      const angles = {
        software: (-5 * Math.PI) / 6 + rotation,
        commons: -Math.PI / 6 + rotation,
        community: Math.PI / 2 + rotation,
      };

      const software = projectPoint(
        centerX + Math.cos(angles.software) * r,
        centerY + Math.sin(angles.software) * r + pointerY * width * 0.018,
        Math.sin(t * 0.018 + 0.2) * outerDepth +
          (Math.cos(angles.software) * pointerX -
            Math.sin(angles.software) * pointerY) *
            outerDepth *
            0.5,
      );
      const commons = projectPoint(
        centerX + Math.cos(angles.commons) * r,
        centerY + Math.sin(angles.commons) * r + pointerY * width * 0.018,
        Math.sin(t * 0.018 + 2.1) * outerDepth +
          (Math.cos(angles.commons) * pointerX -
            Math.sin(angles.commons) * pointerY) *
            outerDepth *
            0.5,
      );
      const community = projectPoint(
        centerX + Math.cos(angles.community) * r,
        centerY + Math.sin(angles.community) * r + pointerY * width * 0.018,
        Math.sin(t * 0.018 + 4.2) * outerDepth +
          (Math.cos(angles.community) * pointerX -
            Math.sin(angles.community) * pointerY) *
            outerDepth *
            0.5,
      );
      const munus = projectPoint(
        centerX + Math.sin(t * 0.024) * munusDrift - pointerX * width * 0.01,
        centerY + Math.cos(t * 0.022) * munusDrift - pointerY * width * 0.012,
        Math.sin(t * 0.017 + 1.2) * centerDepth - pointerY * centerDepth * 0.35,
      );

      return { software, commons, community, munus };
    }

    function drawMarqueeText(
      length,
      label,
      speed,
      rowOffset,
      textColor = 255,
      direction = 1,
    ) {
      const phrase = `${label}    `;
      const phraseWidth = p.textWidth(phrase);
      if (!Number.isFinite(phraseWidth) || phraseWidth <= 0) return;

      const travel = p.frameCount * speed * direction + rowOffset * 2;
      const offset = ((travel % phraseWidth) + phraseWidth) % phraseWidth;
      p.textAlign(p.LEFT, p.CENTER);
      p.noStroke();
      p.fill(textColor);

      for (
        let x = -offset - phraseWidth;
        x < length + phraseWidth;
        x += phraseWidth
      ) {
        p.text(phrase, x, rowOffset);
      }
    }

    function drawEdgeBand(a, b, text, speed, phase = 0, isOuterEdge = true) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 1) return;

      const angle = Math.atan2(dy, dx);
      const avgScale = (a.scale + b.scale) / 2;
      const w = bandWidth;

      p.push();
      p.translate(a.x, a.y);
      p.rotate(angle);

      if (isOuterEdge) {
        const border = nodeStrokeWidth;
        const innerW = Math.max(0.5, w - border * 2);

        // White stroke edge, black center strip, white text.
        p.stroke(255);
        p.strokeWeight(w);
        p.line(0, 0, len, 0);
        p.stroke(0);
        p.strokeWeight(innerW);
        p.line(0, 0, len, 0);

        if (text) {
          p.textSize(edgeLabelSize * avgScale);
          const ctx = p.drawingContext;
          ctx.save();
          ctx.beginPath();
          ctx.rect(0, -innerW * 0.49, len, innerW * 0.98);
          ctx.clip();
          drawMarqueeText(len, text, speed, phase * 0.3, 255, 1);
          ctx.restore();
        }
      } else {
        const innerBandW = w;
        p.stroke(255);
        p.strokeWeight(innerBandW);
        p.line(0, 0, len, 0);

        if (text) {
          p.textSize(edgeLabelSize * 0.95 * avgScale);
          const padX = innerBandW * 0.6;
          const padY = innerBandW * 0.18;
          const clipW = Math.max(0, len - padX * 2);
          const clipH = Math.max(0, innerBandW - padY * 2);
          const ctx = p.drawingContext;
          ctx.save();
          ctx.beginPath();
          ctx.rect(padX, -clipH / 2, clipW, clipH);
          ctx.clip();
          drawMarqueeText(len, text, speed, phase * 0.23, 0, -1);
          ctx.restore();
        }
      }

      p.pop();
    }

    function drawNode(node, id) {
      const baseSize = id === "munus" ? nodeLabelSize + 1 : nodeLabelSize;
      const textSize = baseSize * (0.92 + (node.scale - 1) * 0.35);
      const depthShift = p.map(
        node.z,
        -outerDepth,
        outerDepth,
        nodeTextDepthShift,
        -nodeTextDepthShift,
      );
      const radius =
        (id === "munus" ? centerNodeRadius : outerNodeRadius) * node.scale;

      p.push();
      p.translate(node.x, node.y);

      p.fill(0);
      p.stroke(255);
      p.strokeWeight(nodeStrokeWidth);
      p.circle(0, 0, radius * 2);

      p.noStroke();
      p.fill(255);
      p.textAlign(p.CENTER, p.CENTER);
      p.textSize(textSize);
      p.text(nodeLabels[id], 0, depthShift);

      p.pop();
    }

    p.setup = () => {
      const initialWidth = Math.max(
        220,
        Math.round(container.clientWidth || 360),
      );
      const initialHeight = Math.round(initialWidth * DIAGRAM_ASPECT);
      const canvas = p.createCanvas(initialWidth, initialHeight);
      canvas.parent(container);
      p.pixelDensity(2);
      p.frameRate(30);
      p.textFont("Be Vietnam Pro");
      p.textStyle(p.NORMAL);
      p.strokeCap(p.ROUND);
      recalc();

      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          recalc();
        });
        resizeObserver.observe(container);
      }
    };

    p.windowResized = recalc;

    p.draw = () => {
      p.clear();
      p.background(0);
      const insideCanvas =
        p.mouseX >= 0 &&
        p.mouseX <= width &&
        p.mouseY >= 0 &&
        p.mouseY <= height;
      const targetX = insideCanvas
        ? p.constrain((p.mouseX / width - 0.5) * 2, -1, 1)
        : 0;
      const targetY = insideCanvas
        ? p.constrain((p.mouseY / height - 0.5) * 2, -1, 1)
        : 0;
      pointerX = p.lerp(pointerX, targetX, 0.08);
      pointerY = p.lerp(pointerY, targetY, 0.08);

      const nodes = currentNodes();

      for (let i = 0; i < edgeDefs.length; i += 1) {
        const edge = edgeDefs[i];
        const isOuterEdge = edge.from !== "munus" && edge.to !== "munus";
        drawEdgeBand(
          nodes[edge.from],
          nodes[edge.to],
          edge.text,
          edge.speed,
          i * 3,
          isOuterEdge,
        );
      }

      const nodeOrder = [
        { id: "software", ...nodes.software },
        { id: "commons", ...nodes.commons },
        { id: "community", ...nodes.community },
        { id: "munus", ...nodes.munus },
      ].sort((a, b) => a.z - b.z);

      for (const node of nodeOrder) {
        drawNode(node, node.id);
      }
    };

    p.remove = ((originalRemove) => () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
        resizeObserver = null;
      }
      originalRemove();
    })(p.remove.bind(p));
  };

  return new p5(sketch);
}

function initTrinityDiagrams() {
  const containers = document.querySelectorAll("[data-trinity-sketch]");
  containers.forEach((container) => {
    if (sketches.has(container)) return;
    const instance = createTrinitySketch(container);
    sketches.set(container, instance);
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initTrinityDiagrams, {
    once: true,
  });
} else {
  initTrinityDiagrams();
}

document.addEventListener("astro:page-load", initTrinityDiagrams);
