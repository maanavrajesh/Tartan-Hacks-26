import * as THREE from 'three';

// ─── GLOBALS ────────────────────────────────────────────────
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xf6e9df, 0.02);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2, 10);
camera.lookAt(0, 1, 0);

// ─── COLORS ─────────────────────────────────────────────────
const SOFT_PEACH    = new THREE.Color(0xf6c4a6);
const WARM_IVORY    = new THREE.Color(0xfff3e6);
const SUNSET_ORANGE = new THREE.Color(0xf97316);
const CORAL_RED     = new THREE.Color(0xef4444);
const ROSE_GLOW     = new THREE.Color(0xfb7185);

// ~50% darker blues/purples, ~25% ocean/cyan, ~25% deep purples
const PALETTE = [
  CORAL_RED, SUNSET_ORANGE, ROSE_GLOW, SUNSET_ORANGE,
  CORAL_RED, SUNSET_ORANGE, SOFT_PEACH, ROSE_GLOW,
];

// ─── LIGHTING ───────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffefe3, 0.95));

const key = new THREE.DirectionalLight(0xfff2e8, 2.0);
key.position.set(6, 10, 4);
key.castShadow = true;
scene.add(key);

const rim = new THREE.PointLight(0xffb4a2, 1.1, 30);
rim.position.set(-5, 5, -6);
scene.add(rim);

const fill = new THREE.PointLight(0xffd7c2, 0.8, 25);
fill.position.set(3, 2, 6);
scene.add(fill);

// ─── GROUND (soccer field) ─────────────────────────────────
function createFieldTexture() {
  const size = 1024;
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  const ctx = c.getContext('2d');

  // Base grass
  ctx.fillStyle = '#5b8f47';
  ctx.fillRect(0, 0, size, size);

  // Mowed stripes
  for (let i = 0; i < 12; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#5f984a' : '#557f42';
    ctx.fillRect(0, (i * size) / 12, size, size / 12);
  }

  // Subtle noise
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const v = Math.random() * 30;
    ctx.fillStyle = `rgba(0,0,0,${v / 255})`;
    ctx.fillRect(x, y, 1, 1);
  }

  // Field lines (center circle + halfway line)
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.12, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, size / 2);
  ctx.lineTo(size, size / 2);
  ctx.stroke();

  // Sidelines
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 5;
  ctx.strokeRect(size * 0.06, size * 0.06, size * 0.88, size * 0.88);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.repeat.set(1, 1);
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return tex;
}

const fieldTex = createFieldTexture();
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({
    color: 0x7aa667,
    roughness: 0.95,
    map: fieldTex,
  })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

// ─── GOAL (background) ─────────────────────────────────────
function buildGoal() {
  const goal = new THREE.Group();
  const postMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.4,
    metalness: 0.1,
  });
  const netMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.9,
    metalness: 0.0,
    transparent: true,
    opacity: 0.35,
  });

  const postGeo = new THREE.CylinderGeometry(0.12, 0.12, 3.6, 10);
  const barGeo = new THREE.CylinderGeometry(0.12, 0.12, 11.0, 10);

  const leftPost = new THREE.Mesh(postGeo, postMat);
  leftPost.position.set(-5.5, 1.8, 0);
  const rightPost = new THREE.Mesh(postGeo, postMat);
  rightPost.position.set(5.5, 1.8, 0);
  const crossBar = new THREE.Mesh(barGeo, postMat);
  crossBar.position.set(0, 3.6, 0);
  crossBar.rotation.z = Math.PI / 2;

  // Simple net plane
  const net = new THREE.Mesh(new THREE.PlaneGeometry(11.4, 3.8), netMat);
  net.position.set(0, 1.8, -2.4);

  goal.add(leftPost, rightPost, crossBar, net);
  goal.position.set(0, -0.45, -34);
  return goal;
}

const goal = buildGoal();
scene.add(goal);

// ─── PARTICLES (background ambience) ────────────────────────
const PARTICLE_COUNT = 600;
const particleGeo = new THREE.BufferGeometry();
const pPos = new Float32Array(PARTICLE_COUNT * 3);
for (let i = 0; i < PARTICLE_COUNT; i++) {
  pPos[i * 3]     = (Math.random() - 0.5) * 40;
  pPos[i * 3 + 1] = Math.random() * 20 - 2;
  pPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
}
particleGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
const particleMat = new THREE.PointsMaterial({
  size: 0.06, color: 0xffb89b, transparent: true, opacity: 0.35, depthWrite: false
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

// Background fade group (field + goal + particles)
const bgFadeTargets = [ground, goal, particles];
bgFadeTargets.forEach(obj => {
  obj.traverse?.(child => {
    if (child.material) {
      child.material.transparent = true;
    }
  });
  if (obj.material) obj.material.transparent = true;
});

// ═══════════════════════════════════════════════════════════
//  SOCCER BALL  — truncated icosahedron panels
// ═══════════════════════════════════════════════════════════

function buildSoccerBall() {
  const group = new THREE.Group();
  const panels = [];

  // Use IcosahedronGeometry as the base for vertex positions
  const ico = new THREE.IcosahedronGeometry(1.5, 0);
  const verts = ico.getAttribute('position');
  const faces = [];

  // Gather face triples
  for (let i = 0; i < verts.count; i += 3) {
    faces.push([
      new THREE.Vector3(verts.getX(i), verts.getY(i), verts.getZ(i)),
      new THREE.Vector3(verts.getX(i+1), verts.getY(i+1), verts.getZ(i+1)),
      new THREE.Vector3(verts.getX(i+2), verts.getY(i+2), verts.getZ(i+2)),
    ]);
  }

  // Collect unique vertices
  const uniqueVerts = [];
  const EPS = 0.001;
  function addUnique(v) {
    for (const u of uniqueVerts) { if (u.distanceTo(v) < EPS) return u; }
    const c = v.clone();
    uniqueVerts.push(c);
    return c;
  }
  for (const f of faces) { f.forEach(v => addUnique(v)); }

  // Collect unique edges
  const edgeMidpoints = [];
  function getEdgeMid(a, b) {
    const uA = addUnique(a);
    const uB = addUnique(b);
    for (const e of edgeMidpoints) {
      if ((e.a === uA && e.b === uB) || (e.a === uB && e.b === uA)) return e.mid;
    }
    const mid = new THREE.Vector3().addVectors(uA, uB).multiplyScalar(0.5).normalize().multiplyScalar(1.5);
    edgeMidpoints.push({ a: uA, b: uB, mid });
    return mid;
  }

  // Build hex/pent panels from subdivided faces
  faces.forEach((f, fi) => {
    const [a, b, c] = f;
    const mAB = getEdgeMid(a, b);
    const mBC = getEdgeMid(b, c);
    const mCA = getEdgeMid(c, a);
    const center = new THREE.Vector3().add(a).add(b).add(c).divideScalar(3).normalize().multiplyScalar(1.5);

    // Create 4 sub-panels per face
    const subPanels = [
      [center, mAB, mBC, mCA],  // central triangle (as quad)
      [a, mAB, center, mCA],
      [b, mBC, center, mAB],
      [c, mCA, center, mBC],
    ];

    subPanels.forEach((pts, si) => {
      const panelCenter = new THREE.Vector3();
      pts.forEach(p => panelCenter.add(p));
      panelCenter.divideScalar(pts.length);

      const normal = panelCenter.clone().normalize();

      // Create panel mesh — a small extruded shape
      const shape = new THREE.Shape();
      // Project points onto a local 2D plane for the shape
      const up = new THREE.Vector3(0, 1, 0);
      if (Math.abs(normal.dot(up)) > 0.99) up.set(1, 0, 0);
      const tangent = new THREE.Vector3().crossVectors(normal, up).normalize();
      const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

      const pts2D = pts.map(p => {
        const rel = new THREE.Vector3().subVectors(p, panelCenter);
        return new THREE.Vector2(rel.dot(tangent), rel.dot(bitangent));
      });

      // Shrink slightly for gap effect
      const shrink = 0.88;
      const centroid2D = new THREE.Vector2();
      pts2D.forEach(p => centroid2D.add(p));
      centroid2D.divideScalar(pts2D.length);
      const shrunk = pts2D.map(p =>
        new THREE.Vector2().lerpVectors(centroid2D, p, shrink)
      );

      shape.moveTo(shrunk[0].x, shrunk[0].y);
      for (let i = 1; i < shrunk.length; i++) shape.lineTo(shrunk[i].x, shrunk[i].y);
      shape.closePath();

      const extrudeSettings = { depth: 0.06, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 };
      const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

      // Pick two colors for gradient
      const colorA = PALETTE[(fi + si) % PALETTE.length].clone();
      const colorB = PALETTE[(fi + si + 3) % PALETTE.length].clone();

      // Slight random hue variation on both
      [colorA, colorB].forEach(c => {
        const hsl = {};
        c.getHSL(hsl);
        hsl.h += (Math.random() - 0.5) * 0.04;
        hsl.l += (Math.random() - 0.5) * 0.08;
        c.setHSL(hsl.h, hsl.s, Math.max(0.12, Math.min(0.75, hsl.l)));
      });

      // Apply vertex color gradient across the panel
      const posAttr = geo.getAttribute('position');
      const vertCount = posAttr.count;
      const colors = new Float32Array(vertCount * 3);

      // Find bounding box in local X to define gradient direction
      let minX = Infinity, maxX = -Infinity;
      for (let vi = 0; vi < vertCount; vi++) {
        const vx = posAttr.getX(vi);
        if (vx < minX) minX = vx;
        if (vx > maxX) maxX = vx;
      }
      const rangeX = maxX - minX || 1;

      const tmpColor = new THREE.Color();
      for (let vi = 0; vi < vertCount; vi++) {
        const t = (posAttr.getX(vi) - minX) / rangeX; // 0→1 across panel
        tmpColor.copy(colorA).lerp(colorB, t);
        colors[vi * 3]     = tmpColor.r;
        colors[vi * 3 + 1] = tmpColor.g;
        colors[vi * 3 + 2] = tmpColor.b;
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

      const midColor = colorA.clone().lerp(colorB, 0.5);
      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        roughness: 0.05,
        metalness: 0.0,
        clearcoat: 1.0,
        clearcoatRoughness: 0.02,
        transmission: 0.85,
        ior: 1.45,
        thickness: 0.6,
        transparent: true,
        opacity: 0.9,
        attenuationColor: midColor.clone().lerp(new THREE.Color(0xffffff), 0.6),
        attenuationDistance: 2.6,
        emissive: midColor.clone().multiplyScalar(0.28),
        emissiveIntensity: 0.7,
      });

      const mesh = new THREE.Mesh(geo, mat);
      mesh.castShadow = true;

      // Orient the panel
      const q = new THREE.Quaternion();
      const m4 = new THREE.Matrix4();
      const z = normal.clone();
      const x = tangent.clone();
      const y = bitangent.clone();
      m4.makeBasis(x, y, z);
      q.setFromRotationMatrix(m4);
      mesh.quaternion.copy(q);
      mesh.position.copy(panelCenter);

      group.add(mesh);
      panels.push({
        mesh,
        origPos: panelCenter.clone(),
        origQuat: q.clone(),
        normal: normal.clone(),
        color: midColor.clone(),
      });
    });
  });

  return { group, panels };
}

const { group: ballGroup, panels } = buildSoccerBall();
ballGroup.position.set(0, 1.5, 0);
scene.add(ballGroup);

// ═══════════════════════════════════════════════════════════
//  ANIMATION TIMELINE
// ═══════════════════════════════════════════════════════════

const tl = gsap.timeline({ delay: 0.3 });
const state = { phase: 'intro', shattered: false, time: 0 };
const cta = document.getElementById('cta');

// -- Phase 1: Ball intro — rotate, camera orbit (0s–3s) --
tl.to(ballGroup.rotation, { y: Math.PI * 2, duration: 3, ease: 'power1.inOut' }, 0);
tl.to(camera.position, { x: 3, y: 2.5, z: 8, duration: 3, ease: 'power2.inOut' }, 0);

// -- Phase 2b: Camera swings to side view (3s–4.5s) --
tl.to(camera.position, { x: 5, y: 2, z: 6, duration: 1.5, ease: 'power2.inOut' }, 3);

// -- Phase 3: Kick animation (4.6s–5.4s) --
// (leg removed)

// -- Phase 4: Ball shatter on contact (5.35s) --
tl.call(() => {
  state.shattered = true;
  state.phase = 'shatter';

  // Give each panel a velocity
  panels.forEach(p => {
    const dir = p.normal.clone().add(
      new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8)
    ).normalize();

    p.velocity = dir.multiplyScalar(2.5 + Math.random() * 3.5);
    p.angularVel = new THREE.Vector3(
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8,
      (Math.random() - 0.5) * 8
    );
    p.floatTarget = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      Math.random() * 8 + 1,
      (Math.random() - 0.5) * 14
    );
    p.floatPhase = Math.random() * Math.PI * 2;

    // Enable emissive glow on shatter
    p.mesh.material.emissiveIntensity = 0.5;
  });
}, null, 5.35);

// -- Phase 5: Camera pulls back, logo appears (6s–8s) --
tl.to(camera.position, { x: 0, y: 3, z: 12, duration: 2, ease: 'power2.inOut' }, 5.8);

// Logo fade in
tl.to('#logo', {
  opacity: 1, scale: 1, filter: 'blur(0px)',
  duration: 1.5, ease: 'power3.out'
}, 6.8);
tl.to('#tagline', {
  opacity: 0.7, duration: 1.2, ease: 'power2.out'
}, 7.6);

// CTA appears 2s after the title shows (title at 6.8s → CTA at 8.8s)
tl.to('#cta', {
  opacity: 1,
  y: 0,
  duration: 1.0,
  ease: 'power2.out',
  onStart: () => { cta.style.pointerEvents = 'auto'; }
}, 8.8);

cta.addEventListener('click', () => {
  // Placeholder: wire this to your future site route
  // window.location.href = '/';
  console.log('CTA clicked');
});

// Fade out background after shatter
tl.to(bgFadeTargets.map(o => (o.material ? o.material : null)).filter(Boolean), {
  opacity: 0,
  duration: 2.5,
  ease: 'power2.out'
}, 6.0);
goal.traverse(child => {
  if (child.material) {
    tl.to(child.material, { opacity: 0, duration: 2.5, ease: 'power2.out' }, 6.0);
  }
});

// ═══════════════════════════════════════════════════════════
//  RENDER LOOP
// ═══════════════════════════════════════════════════════════

const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);
  state.time += dt;

  // Idle ball rotation
  if (!state.shattered) {
    ballGroup.rotation.x += dt * 0.3;
  }

  // Shatter physics
  if (state.shattered) {
    panels.forEach(p => {
      if (state.phase === 'shatter') {
        // Explosive phase — decelerate into float
        p.velocity.multiplyScalar(0.97);
        p.mesh.position.add(p.velocity.clone().multiplyScalar(dt));

        const euler = new THREE.Euler(
          p.angularVel.x * dt,
          p.angularVel.y * dt,
          p.angularVel.z * dt
        );
        p.mesh.quaternion.multiply(new THREE.Quaternion().setFromEuler(euler));
        p.angularVel.multiplyScalar(0.98);
      }

      if (state.phase === 'float') {
        // Gentle float
        p.floatPhase += dt * 0.5;
        const target = p.floatTarget;
        p.mesh.position.lerp(target, dt * 0.4);
        p.mesh.position.y += Math.sin(p.floatPhase) * dt * 0.3;

        const euler = new THREE.Euler(
          p.angularVel.x * dt * 0.2,
          p.angularVel.y * dt * 0.2,
          p.angularVel.z * dt * 0.2
        );
        p.mesh.quaternion.multiply(new THREE.Quaternion().setFromEuler(euler));

        // Fade out slowly
        p.mesh.material.opacity = Math.max(0, p.mesh.material.opacity - dt * 0.03);
        p.mesh.material.transparent = true;
      }
    });

    // Transition to float phase after ~1.5 seconds of shatter
    if (state.phase === 'shatter' && state.time > 7.5) {
      state.phase = 'float';
    }
  }

  // Ambient particle drift
  const pArr = particles.geometry.attributes.position.array;
  for (let i = 0; i < PARTICLE_COUNT; i++) {
    pArr[i * 3 + 1] += dt * 0.15;
    if (pArr[i * 3 + 1] > 18) pArr[i * 3 + 1] = -2;
  }
  particles.geometry.attributes.position.needsUpdate = true;

  camera.lookAt(0, 2, 0);
  renderer.render(scene, camera);
}

animate();

// ─── RESIZE ─────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
