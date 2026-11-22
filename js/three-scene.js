/** Interactive Tiered Systems emblem. Four beveled bands form an open copper globe. */
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.domElement.setAttribute("aria-hidden", "true");

  // Broad reflected studio lights keep copper readable without a remote environment map.
  const reflection = document.createElement("canvas");
  reflection.width = 512;
  reflection.height = 256;
  const paint = reflection.getContext("2d");
  paint.fillStyle = "#402720";
  paint.fillRect(0, 0, 512, 256);
  paint.fillStyle = "#ffcd95";
  paint.fillRect(40, 32, 132, 37);
  paint.fillStyle = "#ffe6ca";
  paint.fillRect(275, 63, 57, 104);
  paint.fillStyle = "#ae6b46";
  paint.fillRect(390, 150, 80, 45);
  const studio = new THREE.CanvasTexture(reflection);
  studio.mapping = THREE.EquirectangularReflectionMapping;
  studio.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromEquirectangular(studio).texture;
  pmrem.dispose();
  studio.dispose();

  scene.add(new THREE.HemisphereLight(0xffca97, 0x392921, 1.05));
  const keyLight = new THREE.DirectionalLight(0xffdbb3, 2.5);
  keyLight.position.set(4, 7, 5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0xff9a49, 2.8);
  rimLight.position.set(-5, -3, 1);
  scene.add(rimLight);

  const assembly = new THREE.Group();
  scene.add(assembly);

  const copper = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.32,
    metalness: 0.68
  });
  const bands = [
    { radius: 2.13, width: 0.44, depth: 0.29, tilt: [Math.PI / 2, 0, 0] },
    { radius: 2.08, width: 0.31, depth: 0.17, tilt: [0.37, 0, 0.23] },
    { radius: 2.02, width: 0.19, depth: 0.16, tilt: [0.04, 0.24, Math.PI / 2] },
    { radius: 1.99, width: 0.22, depth: 0.16, tilt: [0.48, 0, -0.68] }
  ];
  for (const { radius, width, depth, tilt } of bands) {
    const band = new THREE.Mesh(beveledBand(THREE, radius, width, depth), copper);
    band.rotation.set(...tilt, "YXZ");
    assembly.add(band);
  }

  const glints = [
    makeGlint(THREE, scene, [-1.48, -1.45, 0.21], -0.33, 1.0),
    makeGlint(THREE, scene, [1.92, -0.82, 0.20], -0.29, 0.8)
  ];
  const stageAngles = [
    [-0.03, -0.06],
    [0.05, 0.29],
    [-0.21, 0.20],
    [0.17, -0.31]
  ];

  let active = 0;
  let targetTurn = 0;
  let targetTilt = 0;
  let frame = 0;
  let visible = true;
  let paused = false;
  let dragStart = null;
  let lastTime = 0;
  let glintWake = 0;
  const requestRender = () => {
    if (!frame && visible && !paused) frame = requestAnimationFrame(render);
  };

  updateModel = index => {
    if (active !== index) glintWake = performance.now();
    active = index;
    requestRender();
  };

  function render(now) {
    frame = 0;
    if (!visible || paused) return;
    const reduced = motionPreference.matches;
    const settle = reduced ? 1 : 1 - Math.exp(-Math.min(now - lastTime, 50) / 170);
    lastTime = now;
    const [stageTilt, stageTurn] = stageAngles[active];
    const idle = reduced ? 0 : Math.sin(now / 2650) * 0.035;
    assembly.rotation.x += (stageTilt + (reduced ? 0 : targetTilt) - assembly.rotation.x) * settle;
    assembly.rotation.y += (stageTurn + (reduced ? 0 : targetTurn) + idle - assembly.rotation.y) * settle;
    assembly.updateMatrixWorld();
    const wake = reduced || glintWake === 0 ? 0 : Math.exp(-Math.max(0, now - glintWake) / 380);
    for (const { flare, anchor, brightness } of glints) {
      flare.position.copy(anchor).applyMatrix4(assembly.matrixWorld);
      flare.position.z += 0.026;
      flare.scale.x = 1 + wake * 0.36;
      flare.material.uniforms.strength.value = brightness * (0.78 + wake * 0.45);
    }
    renderer.render(scene, camera);
    if (!reduced) requestRender();
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
    dragStart = event.clientX;
    container.setPointerCapture(event.pointerId);
  });
  container.addEventListener("pointermove", event => {
    if (motionPreference.matches) return;
    if (dragStart !== null) {
      targetTurn = THREE.MathUtils.clamp((event.clientX - dragStart) / 225, -0.64, 0.64);
      return;
    }
    if (event.pointerType !== "mouse") return;
    const box = container.getBoundingClientRect();
    targetTurn = ((event.clientX - box.left) / box.width - 0.5) * 0.26;
    targetTilt = ((event.clientY - box.top) / box.height - 0.5) * 0.16;
  });
  container.addEventListener("pointerenter", () => {
    glintWake = performance.now();
  });
  const resetMotion = () => {
    dragStart = null;
    targetTurn = 0;
    targetTilt = 0;
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
    container.classList.add("has-model");
  });

  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    requestRender();
  }).observe(container);
  motionPreference.addEventListener("change", requestRender);

  container.appendChild(renderer.domElement);
  resize();
  container.classList.add("has-model");
}

function beveledBand(THREE, radius, width, depth) {
  // Wrap a beveled rectangular section around a great circle of the globe.
  const half = width / 2;
  const bevel = 0.036;
  const flank = Math.sqrt(radius * radius - half * half);
  const section = [
    [flank - depth, -half + bevel, 0x663822],
    [flank - depth + bevel, -half, 0x9c5a32],
    [flank - bevel, -half, 0xe2a76d],
    [flank, -half + bevel, 0xffcc91],
    [radius, 0, 0xaa572b],
    [flank, half - bevel, 0xffcc91],
    [flank - bevel, half, 0xe2a76d],
    [flank - depth + bevel, half, 0x9c5a32],
    [flank - depth, half - bevel, 0x663822]
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

function makeGlint(THREE, scene, point, angle, brightness) {
  // A tight white reflection, wider amber bloom and directional lens streak share one plane.
  const flare = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 0.9),
    new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor,
      blendDst: THREE.OneFactor,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
      depthTest: false,
      depthWrite: false,
      uniforms: { strength: { value: brightness } },
      vertexShader: `
        varying vec2 lens;
        void main() {
          lens = uv * 2.0 - 1.0;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 lens;
        uniform float strength;
        void main() {
          vec2 core = lens * vec2(21.0, 7.0);
          vec2 bloom = lens * vec2(5.5, 2.5);
          vec2 smear = lens * vec2(2.35, 16.0);
          float peak = exp(-dot(core, core));
          float halo = exp(-dot(bloom, bloom));
          float streak = exp(-dot(smear, smear));
          vec3 light = mix(vec3(1.0, 0.42, 0.13), vec3(1.0, 0.98, 0.85), peak);
          float edge = 1.0 - smoothstep(0.73, 1.0, max(abs(lens.x), abs(lens.y)));
          gl_FragColor = vec4(light, min(1.0, strength * (peak + 0.21 * halo + 0.38 * streak)) * edge);
        }
      `
    })
  );
  flare.rotation.z = angle;
  scene.add(flare);
  return { flare, anchor: new THREE.Vector3(...point), brightness };
}
