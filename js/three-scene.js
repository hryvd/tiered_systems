/** Interactive Tiered Systems emblem. Four beveled bands form an open globe. */
const container = document.getElementById("emblem-3d-canvas");
const indicator = document.getElementById("indicator-tier-name");
const stageLabels = [
  "Prepare · Résumé & project artifact",
  "Level Up · LinkedIn & technical pitch",
  "Discover · Industry keynote & alumni panel",
  "Connect · Opportunity Radar"
];
let updateModel = () => {};
let selectedTier = 1;

window.set3DActiveTier = tier => {
  if (!stageLabels[tier - 1]) return;
  selectedTier = tier;
  if (indicator) indicator.textContent = stageLabels[tier - 1];
  document.querySelectorAll("[data-stage-tier]").forEach(button => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.stageTier) === tier));
  });
  updateModel(tier - 1);
};

window.set3DActiveTier(selectedTier);
if (container) {
  const preload = new IntersectionObserver(([entry]) => {
    if (!entry.isIntersecting) return;
    preload.disconnect();
    startEmblem();
  }, { rootMargin: "240px" });
  preload.observe(container);
}

async function startEmblem() {
  try {
    // Vite bundles Three.js. Branch-based GitHub Pages serves the source HTML directly.
    const three = import.meta.env ? await import("./three-runtime.js") : await loadStaticThree();
    initEmblem(three);
    updateModel(selectedTier - 1);
  } catch (error) {
    console.warn("The emblem is using its static preview.", error);
  }
}

function loadStaticThree() {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js";
    script.integrity = "sha384-qOkzR5Ke/XkQxuGVJ9hpFEpDlcoLtWwVYhnJf06cLIZa2vaIptSqaubivErzmD5O";
    script.crossOrigin = "anonymous";
    script.onload = () => resolve(window.THREE);
    script.onerror = () => reject(new Error("Three.js did not load"));
    document.head.appendChild(script);
  });
}

function initEmblem(THREE) {
  const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 40);
  camera.position.set(0, 0, 9.6);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.domElement.setAttribute("aria-hidden", "true");

  // Wide, feathered light sources soften the reflections along the bevels.
  const reflection = document.createElement("canvas");
  reflection.width = 512;
  reflection.height = 256;
  const paint = reflection.getContext("2d");
  paint.fillStyle = "#303237";
  paint.fillRect(0, 0, 512, 256);
  for (const [x, y, radius, color] of [
    [100, 47, 93, "#e4dfd5"],
    [281, 99, 72, "#d4dded"],
    [421, 149, 94, "#a4a7af"]
  ]) {
    const light = paint.createRadialGradient(x, y, 0, x, y, radius);
    light.addColorStop(0, color);
    light.addColorStop(1, "transparent");
    paint.fillStyle = light;
    paint.fillRect(0, 0, 512, 256);
  }
  const studio = new THREE.CanvasTexture(reflection);
  studio.mapping = THREE.EquirectangularReflectionMapping;
  studio.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(studio).texture;
  pmrem.dispose();
  studio.dispose();

  scene.add(new THREE.HemisphereLight(0xe4e6ed, 0x33343b, 1.4));
  const keyLight = new THREE.DirectionalLight(0xf1eee8, 2.0);
  keyLight.position.set(4, 7, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xdce5f3, 1.1);
  rimLight.position.set(-5, -3, 1);
  scene.add(rimLight);

  const assembly = new THREE.Group();
  scene.add(assembly);

  const glass = new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.34,
    metalness: 0.24,
    transmission: 0.54,
    ior: 1.46,
    thickness: 0.4,
    clearcoat: 0.5,
    clearcoatRoughness: 0.28
  });
  const bands = [
    { radius: 2.13, width: 0.44, depth: 0.29, tilt: [Math.PI / 2, 0, 0] },
    { radius: 2.08, width: 0.31, depth: 0.17, tilt: [0.37, 0, 0.23] },
    { radius: 2.02, width: 0.19, depth: 0.16, tilt: [0.04, 0.24, Math.PI / 2] },
    { radius: 1.99, width: 0.22, depth: 0.16, tilt: [0.48, 0, -0.68] }
  ];
  for (const { radius, width, depth, tilt } of bands) {
    const band = new THREE.Mesh(beveledBand(THREE, radius, width, depth), glass);
    band.rotation.set(...tilt, "YXZ");
    assembly.add(band);
  }

  const stageAngles = [
    [-0.03, -0.06],
    [0.05, 0.29],
    [-0.21, 0.20],
    [0.17, -0.31]
  ];
  assembly.rotation.set(...stageAngles[0], 0);

  let active = 0;
  let targetTurn = 0;
  let targetTilt = 0;
  let frame = 0;
  let visible = true;
  let paused = false;
  let dragStart = null;
  let lastTime = 0;
  const requestRender = () => {
    if (!frame && visible && !paused) frame = requestAnimationFrame(render);
  };

  updateModel = index => {
    active = index;
    requestRender();
  };

  function render(now) {
    frame = 0;
    if (!visible || paused) return;
    const reduced = motionPreference.matches;
    const [stageTilt, stageTurn] = stageAngles[active];
    const tiltDelta = stageTilt + (reduced ? 0 : targetTilt) - assembly.rotation.x;
    const turnDelta = stageTurn + (reduced ? 0 : targetTurn) - assembly.rotation.y;
    const animating = !reduced && Math.max(Math.abs(tiltDelta), Math.abs(turnDelta)) > 0.001;
    const elapsed = lastTime ? now - lastTime : 1000 / 60;
    const settle = animating ? 1 - Math.exp(-elapsed / 145) : 1;
    lastTime = animating ? now : 0;
    assembly.rotation.x += tiltDelta * settle;
    assembly.rotation.y += turnDelta * settle;
    renderer.render(scene, camera);
    if (!container.classList.contains("has-model")) container.classList.add("has-model");
    if (animating) requestRender();
  }

  const resize = () => {
    const width = container.clientWidth;
    const height = container.clientHeight;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.zoom = Math.min(1, camera.aspect / 0.97);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
    requestRender();
  };

  container.addEventListener("pointerdown", event => {
    if (motionPreference.matches) return;
    dragStart = event.clientX;
    container.setPointerCapture(event.pointerId);
  });
  container.addEventListener("pointermove", event => {
    if (motionPreference.matches) return;
    if (dragStart !== null) {
      targetTurn = THREE.MathUtils.clamp((event.clientX - dragStart) / 250, -0.52, 0.52);
      requestRender();
      return;
    }
    if (event.pointerType !== "mouse") return;
    const box = container.getBoundingClientRect();
    targetTurn = ((event.clientX - box.left) / box.width - 0.5) * 0.21;
    targetTilt = ((event.clientY - box.top) / box.height - 0.5) * 0.13;
    requestRender();
  });
  const resetMotion = () => {
    dragStart = null;
    targetTurn = 0;
    targetTilt = 0;
    requestRender();
  };
  container.addEventListener("lostpointercapture", resetMotion);
  container.addEventListener("pointerleave", resetMotion);

  renderer.domElement.addEventListener("webglcontextlost", event => {
    event.preventDefault();
    paused = true;
    container.classList.remove("has-model");
  });
  renderer.domElement.addEventListener("webglcontextrestored", () => {
    paused = false;
    requestRender();
  });

  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    requestRender();
  }).observe(container);
  motionPreference.addEventListener("change", requestRender);

  container.appendChild(renderer.domElement);
  resize();
}

function beveledBand(THREE, radius, width, depth) {
  // Wrap a beveled rectangular section around a great circle of the globe.
  const half = width / 2;
  const bevel = 0.036;
  const flank = Math.sqrt(radius * radius - half * half);
  const section = [
    [flank - depth, -half + bevel, 0x45474f],
    [flank - depth + bevel, -half, 0x64646c],
    [flank - bevel, -half, 0xaaa8a0],
    [flank, -half + bevel, 0xc6c2b8],
    [radius, 0, 0x757882],
    [flank, half - bevel, 0xc6c2b8],
    [flank - bevel, half, 0xaaa8a0],
    [flank - depth + bevel, half, 0x64646c],
    [flank - depth, half - bevel, 0x45474f]
  ];
  section.push(section[0]);
  const geometry = new THREE.LatheGeometry(section.map(([x, y]) => new THREE.Vector2(x, y)), 144);
  const palette = section.map(([, , color]) => new THREE.Color(color));
  const colors = new Float32Array(geometry.attributes.position.count * 3);
  for (let i = 0; i < geometry.attributes.position.count; i++) {
    palette[i % palette.length].toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geometry;
}
