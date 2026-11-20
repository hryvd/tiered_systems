/**
 * Tiered Systems · Official 3D Emblem & 4-Tier Progression Architecture
 * Faithfully engineered from the CURSOR Tiered System visual identity:
 * - Official golden-bronze interlocking triquetra spherical core emblem
 * - Matrix of beveled chassis squircle tiles with backlighting
 * - 4 interactive ascending tier platforms (Prepare, Level Up, Discover, Connect)
 */

(function () {
  const container = document.getElementById("emblem-3d-canvas");
  if (!container || !window.THREE) return;

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Scene, Camera, Renderer
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(0, 0.8, 8.2);

  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.3;
  container.appendChild(renderer.domElement);

  // Master group that tilts and rotates with mouse/touch interaction
  const masterGroup = new THREE.Group();
  scene.add(masterGroup);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
  scene.add(ambientLight);

  // Radiant Solar Orange Core Light
  const coreLight = new THREE.PointLight(0xff6b00, 3.8, 14, 1.2);
  coreLight.position.set(0, 0.2, 0);
  masterGroup.add(coreLight);

  // Key light for crisp metallic specular highlights
  const keyLight = new THREE.DirectionalLight(0xfff3e6, 2.4);
  keyLight.position.set(6, 6, 7);
  scene.add(keyLight);

  // Rim back-light for edge separation
  const rimLight = new THREE.DirectionalLight(0xff7700, 3.2);
  rimLight.position.set(-6, -4, -4);
  scene.add(rimLight);

  // Materials
  // 1. Brushed Golden-Bronze Metallic (Official Tiered System Emblem)
  const bronzeEmblemMat = new THREE.MeshStandardMaterial({
    color: 0xdf8428,
    metalness: 0.94,
    roughness: 0.22,
    envMapIntensity: 1.6
  });

  // 2. Obsidian Beveled Chassis Material (Background Squircles)
  const chassisTileMat = new THREE.MeshStandardMaterial({
    color: 0x0f1118,
    metalness: 0.88,
    roughness: 0.42
  });

  // 3. Glowing Core Sphere Material
  const coreGlowMat = new THREE.MeshStandardMaterial({
    color: 0xff6b00,
    emissive: 0xff4800,
    emissiveIntensity: 0.75,
    metalness: 0.7,
    roughness: 0.3
  });

  // --- 1. Background Matrix of Squircle Chassis Tiles (From CURSOR Poster) ---
  const tileGroup = new THREE.Group();
  tileGroup.position.z = -1.6;
  masterGroup.add(tileGroup);

  const tileSize = 1.45;
  const tileGap = 1.7;
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      // Create rounded plate using ExtrudeGeometry with Rounded Rect
      const shape = new THREE.Shape();
      const r = 0.28;
      const w = tileSize;
      const h = tileSize;
      const x = -w / 2;
      const y = -h / 2;

      shape.moveTo(x + r, y);
      shape.lineTo(x + w - r, y);
      shape.quadraticCurveTo(x + w, y, x + w, y + r);
      shape.lineTo(x + w, y + h - r);
      shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
      shape.lineTo(x + r, y + h);
      shape.quadraticCurveTo(x, y + h, x, y + h - r);
      shape.lineTo(x, y + r);
      shape.quadraticCurveTo(x, y, x + r, y);

      const extrudeSettings = {
        depth: 0.12,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.08,
        bevelThickness: 0.08
      };

      const tileGeo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      tileGeo.center();
      const tileMesh = new THREE.Mesh(tileGeo, chassisTileMat.clone());
      tileMesh.position.set(col * tileGap, row * tileGap, 0);
      tileGroup.add(tileMesh);
    }
  }

  // --- 2. Official Tiered System 3D Interlocking Core Emblem ---
  const emblemCoreGroup = new THREE.Group();
  emblemCoreGroup.position.set(0, 0.4, 0);
  masterGroup.add(emblemCoreGroup);

  // Central radiant sphere
  const coreSphereGeo = new THREE.SphereGeometry(0.85, 32, 32);
  const coreSphereMesh = new THREE.Mesh(coreSphereGeo, coreGlowMat);
  emblemCoreGroup.add(coreSphereMesh);

  // Three Interlocking Metallic Torus Bands (Symmetrical Triquetra Knot)
  const bandRadius = 1.62;
  const bandTube = 0.095;
  const bandGeo = new THREE.TorusGeometry(bandRadius, bandTube, 28, 96);

  // Band 1: Equatorial
  const band1 = new THREE.Mesh(bandGeo, bronzeEmblemMat.clone());
  band1.rotation.x = Math.PI / 2;
  emblemCoreGroup.add(band1);

  // Band 2: Rotated 60 degrees
  const band2 = new THREE.Mesh(bandGeo, bronzeEmblemMat.clone());
  band2.rotation.x = Math.PI / 3.4;
  band2.rotation.y = Math.PI / 4;
  emblemCoreGroup.add(band2);

  // Band 3: Rotated -60 degrees
  const band3 = new THREE.Mesh(bandGeo, bronzeEmblemMat.clone());
  band3.rotation.x = -Math.PI / 3.4;
  band3.rotation.y = -Math.PI / 4;
  emblemCoreGroup.add(band3);

  // --- 3. The 4 Ascending Tier Platforms (Prepare, Level Up, Discover, Connect) ---
  const tierPlatforms = [];
  const tierConfigs = [
    { tier: 1, name: "Prepare", radius: 2.7, yPos: -1.7, label: "Tier 01: Prepare · Resume & Project Artifact" },
    { tier: 2, name: "Level Up", radius: 2.2, yPos: -1.45, label: "Tier 02: Level Up · LinkedIn Architecture & Pitch" },
    { tier: 3, name: "Discover", radius: 1.7, yPos: -1.2, label: "Tier 03: Discover · Industry Keynote & Alumni Panel" },
    { tier: 4, name: "Connect", radius: 1.2, yPos: -0.95, label: "Tier 04: Connect · Active MOA Opportunity Board" }
  ];

  tierConfigs.forEach((cfg, idx) => {
    const platformGroup = new THREE.Group();
    platformGroup.position.y = cfg.yPos;
    masterGroup.add(platformGroup);

    // Dark metallic disc platform
    const discGeo = new THREE.CylinderGeometry(cfg.radius, cfg.radius * 1.04, 0.06, 48);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x141620,
      metalness: 0.9,
      roughness: 0.4
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    platformGroup.add(discMesh);

    // Glowing perimeter circuit rim
    const rimGeo = new THREE.TorusGeometry(cfg.radius * 1.02, 0.035, 16, 64);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0x444b60,
      emissive: 0x000000,
      emissiveIntensity: 0,
      metalness: 0.8,
      roughness: 0.2
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.rotation.x = Math.PI / 2;
    rimMesh.position.y = 0.035;
    platformGroup.add(rimMesh);

    tierPlatforms.push({
      tier: cfg.tier,
      group: platformGroup,
      discMesh: discMesh,
      rimMesh: rimMesh,
      baseY: cfg.yPos,
      targetY: cfg.yPos,
      label: cfg.label
    });
  });

  // Ambient Circuit Node Dust (Gentle particles)
  const particleCount = reduceMotion ? 15 : 45;
  const particleGeo = new THREE.BufferGeometry();
  const particlePos = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount * 3; i += 3) {
    const r = 2.2 + Math.random() * 2.8;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particlePos[i] = r * Math.sin(phi) * Math.cos(theta);
    particlePos[i + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    particlePos[i + 2] = r * Math.cos(phi);
  }
  particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePos, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0xffaa44,
    size: 0.05,
    transparent: true,
    opacity: 0.65
  });
  const particles = new THREE.Points(particleGeo, particleMat);
  masterGroup.add(particles);

  // Interactive Mouse / Touch Parallax
  let mouseX = 0;
  let mouseY = 0;
  let targetRotationX = 0.15; // subtle natural top-down isometric view
  let targetRotationY = 0;
  let isHovered = false;

  function onPointerMove(e) {
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    if (x >= 0 && x <= rect.width && y >= 0 && y <= rect.height) {
      mouseX = (x / rect.width) * 2 - 1;
      mouseY = -(y / rect.height) * 2 + 1;
      targetRotationY = mouseX * 0.65;
      targetRotationX = 0.15 - mouseY * 0.45;
      isHovered = true;
    } else {
      isHovered = false;
    }
  }

  window.addEventListener("pointermove", onPointerMove, { passive: true });

  // Touch drag support
  let isDragging = false;
  let prevTouchX = 0;
  let prevTouchY = 0;

  container.addEventListener("touchstart", (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      prevTouchX = e.touches[0].clientX;
      prevTouchY = e.touches[0].clientY;
    }
  }, { passive: true });

  window.addEventListener("touchmove", (e) => {
    if (!isDragging || e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - prevTouchX;
    const dy = e.touches[0].clientY - prevTouchY;
    targetRotationY += dx * 0.007;
    targetRotationX = Math.max(-0.4, Math.min(0.6, targetRotationX + dy * 0.007));
    prevTouchX = e.touches[0].clientX;
    prevTouchY = e.touches[0].clientY;
  }, { passive: true });

  window.addEventListener("touchend", () => { isDragging = false; });

  // Responsiveness
  function onResize() {
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }
  window.addEventListener("resize", onResize, { passive: true });

  // Pause rendering when off-screen for battery & performance
  let isVisible = true;
  const observer = new IntersectionObserver(([entry]) => {
    isVisible = entry.isIntersecting;
  }, { threshold: 0.05 });
  observer.observe(container);

  // Active Tier State Handler (Called when user clicks a tier in the UI)
  window.set3DActiveTier = function (tierNum) {
    const indicatorEl = document.getElementById("indicator-tier-name");

    tierPlatforms.forEach((p) => {
      const match = p.tier === tierNum;
      if (match) {
        // Bright Solar Orange glow on active tier rim
        p.rimMesh.material.color.setHex(0xff6b00);
        p.rimMesh.material.emissive.setHex(0xff6b00);
        p.rimMesh.material.emissiveIntensity = 1.4;
        p.discMesh.material.color.setHex(0x242838);
        p.targetY = p.baseY + 0.14; // Slightly elevate active tier platform

        if (indicatorEl) {
          indicatorEl.textContent = p.label;
        }
      } else {
        // Inactive tiers stay subtle dark metallic
        p.rimMesh.material.color.setHex(0x363a4d);
        p.rimMesh.material.emissive.setHex(0x000000);
        p.rimMesh.material.emissiveIntensity = 0;
        p.discMesh.material.color.setHex(0x141620);
        p.targetY = p.baseY;
      }
    });

    // Intensify core light pulse on tier switch
    coreLight.intensity = 4.8;
    setTimeout(() => { coreLight.intensity = 3.8; }, 350);
  };

  // Set default initial active tier to 1
  window.set3DActiveTier(1);

  // Animation Loop
  let clock = new THREE.Clock();

  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return;

    const delta = clock.getDelta();

    // Constant smooth background rotation of emblem and squircle backdrop
    if (!reduceMotion) {
      emblemCoreGroup.rotation.y += 0.005;
      emblemCoreGroup.rotation.x = Math.sin(clock.getElapsedTime() * 0.8) * 0.08;
      particles.rotation.y -= 0.0015;
    }

    // Smooth lerping of platform elevation heights
    tierPlatforms.forEach(p => {
      p.group.position.y += (p.targetY - p.group.position.y) * 0.12;
    });

    // Spring interpolation toward target rotation
    masterGroup.rotation.y += (targetRotationY - masterGroup.rotation.y) * 0.06;
    masterGroup.rotation.x += (targetRotationX - masterGroup.rotation.x) * 0.06;

    renderer.render(scene, camera);
  }

  animate();
})();
