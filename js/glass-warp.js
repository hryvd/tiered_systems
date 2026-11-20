/**
 * TIERED SYSTEMS · Edge Optical Refraction Filter
 * Generates a subtle 128x128 edge-only displacement map on an offscreen canvas
 * (neutral 128,128 across the center ~72% so inner text stays sharp, curving smoothly
 * across the outer ~14% edge band) and injects SVG filter #lg-edge-warp for Chromium.
 */

(function initEdgeWarpFilter() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (document.getElementById("lg-edge-warp")) return;

  const isChromium =
    Boolean(window.chrome) &&
    typeof CSS !== "undefined" &&
    CSS.supports("backdrop-filter", "blur(10px)");

  if (!isChromium) return;

  const size = 128;
  const band = 0.28; // 0.28 of [-1, 1] = 14% perimeter band on each side, leaving 72% flat center
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const img = ctx.createImageData(size, size);
  const data = img.data;

  for (let y = 0; y < size; y++) {
    const ny = ((y + 0.5) / size) * 2 - 1;
    const ay = Math.abs(ny);
    const ty = Math.max(0, (band - (1 - ay)) / band);
    const sy = ty * ty * (3 - 2 * ty);

    for (let x = 0; x < size; x++) {
      const nx = ((x + 0.5) / size) * 2 - 1;
      const ax = Math.abs(nx);
      const tx = Math.max(0, (band - (1 - ax)) / band);
      const sx = tx * tx * (3 - 2 * tx);

      const dispX = Math.sign(nx) * sx;
      const dispY = Math.sign(ny) * sy;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round(128 + dispX * 124);
      data[idx + 1] = Math.round(128 + dispY * 124);
      data[idx + 2] = 128;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const dataUrl = canvas.toDataURL("image/png");

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS, "svg");
  svg.setAttribute("id", "lg-edge-warp-svg");
  svg.setAttribute("aria-hidden", "true");
  svg.style.cssText = "position:fixed;width:0;height:0;pointer-events:none;overflow:hidden;";

  const defs = document.createElementNS(svgNS, "defs");
  const filter = document.createElementNS(svgNS, "filter");
  filter.setAttribute("id", "lg-edge-warp");
  filter.setAttribute("x", "0%");
  filter.setAttribute("y", "0%");
  filter.setAttribute("width", "100%");
  filter.setAttribute("height", "100%");
  filter.setAttribute("color-interpolation-filters", "sRGB");

  const feImage = document.createElementNS(svgNS, "feImage");
  feImage.setAttribute("href", dataUrl);
  feImage.setAttribute("preserveAspectRatio", "none");
  feImage.setAttribute("result", "warpMap");

  const feDisp = document.createElementNS(svgNS, "feDisplacementMap");
  feDisp.setAttribute("in", "SourceGraphic");
  feDisp.setAttribute("in2", "warpMap");
  feDisp.setAttribute("scale", "16");
  feDisp.setAttribute("xChannelSelector", "R");
  feDisp.setAttribute("yChannelSelector", "G");

  filter.appendChild(feImage);
  filter.appendChild(feDisp);
  defs.appendChild(filter);
  svg.appendChild(defs);

  const attach = () => {
    if (!document.getElementById("lg-edge-warp-svg") && document.body) {
      document.body.appendChild(svg);
      document.documentElement.classList.add("has-edge-warp");
    }
  };

  if (document.body) {
    attach();
  } else {
    document.addEventListener("DOMContentLoaded", attach, { once: true });
  }
})();
