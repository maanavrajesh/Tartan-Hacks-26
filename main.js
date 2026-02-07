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
scene.fog = new THREE.FogExp2(0x0a0a12, 0.025);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 2, 10);
camera.lookAt(0, 1, 0);

// ─── COLORS ─────────────────────────────────────────────────
const OCEAN      = new THREE.Color(0x0077b6);
const DEEP_PURPLE = new THREE.Color(0x6a1b9a);
const DARK_VIOLET = new THREE.Color(0x4a148c);
const NAVY_BLUE  = new THREE.Color(0x003f88);
const DARK_TEAL  = new THREE.Color(0x005f73);

// ~50% darker blues/purples, ~25% ocean/cyan, ~25% deep purples
const PALETTE = [
  OCEAN, DEEP_PURPLE, NAVY_BLUE, DARK_VIOLET,
  DARK_TEAL, DEEP_PURPLE, NAVY_BLUE, DARK_VIOLET,
];

// ─── LIGHTING ───────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x334466, 0.6));

const key = new THREE.DirectionalLight(0xccddff, 1.8);
key.position.set(5, 8, 6);
key.castShadow = true;
scene.add(key);

const rim = new THREE.PointLight(0x7c3aed, 1.2, 30);
rim.position.set(-4, 4, -4);
scene.add(rim);

const fill = new THREE.PointLight(0x00b4d8, 0.8, 25);
fill.position.set(3, 1, 5);
scene.add(fill);

// ─── GROUND (subtle) ───────────────────────────────────────
const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(80, 80),
  new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.95 })
);
ground.rotation.x = -Math.PI / 2;
ground.position.y = -0.5;
ground.receiveShadow = true;
scene.add(ground);

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
  size: 0.06, color: 0x00b4d8, transparent: true, opacity: 0.4, depthWrite: false
});
const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

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
      const mat = new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.3,
        metalness: 0.15,
        emissive: midColor.clone().multiplyScalar(0.15),
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
//  SILHOUETTE LEG — built from primitives
// ═══════════════════════════════════════════════════════════

function buildLegSilhouette() {
  const leg = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xeef0ff,
    roughness: 0.4,
    metalness: 0.05,
    emissive: 0xaabbee,
    emissiveIntensity: 0.25,
    transparent: true,
    opacity: 1,
    flatShading: true,
  });

  // 2.5D leg: thin boxes to read as 2D silhouette with depth cues
  const DEPTH = 0.08;

  // Hip pivot (top of leg)
  const thighPivot = new THREE.Group();
  thighPivot.position.y = 2.4;
  leg.add(thighPivot);

  // Thigh
  const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.45, 1.6, DEPTH), mat);
  thigh.position.y = -0.8;
  thighPivot.add(thigh);

  // Knee pivot
  const calfPivot = new THREE.Group();
  calfPivot.position.y = -1.55;
  thighPivot.add(calfPivot);

  // Calf
  const calf = new THREE.Mesh(new THREE.BoxGeometry(0.38, 1.4, DEPTH), mat);
  calf.position.y = -0.7;
  calfPivot.add(calf);

  // Ankle pivot
  const footPivot = new THREE.Group();
  footPivot.position.y = -1.3;
  calfPivot.add(footPivot);

  // Foot
  const foot = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.14, DEPTH), mat);
  foot.position.set(0.05, -0.08, 0.12);
  footPivot.add(foot);

  return { leg, thighPivot, calfPivot, footPivot, material: mat };
}

const leg = buildLegSilhouette();
// Position the leg in the upper half and let it extend beyond the top of the frame
leg.leg.position.set(-10, 3.0, 2);
leg.leg.scale.set(1.6, 1.6, 1.6);
leg.leg.rotation.y = 0.3;
leg.leg.visible = false;
scene.add(leg.leg);

// ═══════════════════════════════════════════════════════════
//  ANIMATION TIMELINE
// ═══════════════════════════════════════════════════════════

const tl = gsap.timeline({ delay: 0.3 });
const state = { phase: 'intro', shattered: false, time: 0 };

// -- Phase 1: Ball intro — rotate, camera orbit (0s–3s) --
tl.to(ballGroup.rotation, { y: Math.PI * 2, duration: 3, ease: 'power1.inOut' }, 0);
tl.to(camera.position, { x: 3, y: 2.5, z: 8, duration: 3, ease: 'power2.inOut' }, 0);

// -- Phase 2: Leg enters from far left (2.5s–4.2s) --
tl.call(() => { leg.leg.visible = true; }, null, 2.5);
tl.to(leg.leg.position, { x: -2.2, duration: 1.7, ease: 'power2.inOut' }, 2.5);
tl.to(leg.leg.rotation, { y: 0.1, duration: 1.7, ease: 'power2.inOut' }, 2.5);

// Wind-up for kick
tl.to(leg.thighPivot.rotation, { x: 0.65, duration: 0.45, ease: 'power2.inOut' }, 4.3);
tl.to(leg.calfPivot.rotation, { x: -0.6, duration: 0.45, ease: 'power2.inOut' }, 4.3);
tl.to(leg.footPivot.rotation, { x: 0.25, duration: 0.45, ease: 'power2.inOut' }, 4.3);

// -- Phase 2b: Camera swings to side view (3s–4.5s) --
tl.to(camera.position, { x: 5, y: 2, z: 6, duration: 1.5, ease: 'power2.inOut' }, 3);

// -- Phase 3: Kick animation (4.6s–5.4s) --
tl.to(leg.thighPivot.rotation, { x: -0.9, duration: 0.35, ease: 'power3.in' }, 4.6);
tl.to(leg.calfPivot.rotation, { x: 0.2, duration: 0.35, ease: 'power3.in' }, 4.6);
tl.to(leg.footPivot.rotation, { x: -0.15, duration: 0.35, ease: 'power3.in' }, 4.6);
tl.to(leg.thighPivot.rotation, { x: -0.35, duration: 0.4, ease: 'power4.out' }, 4.95);
tl.to(leg.calfPivot.rotation, { x: 0.35, duration: 0.4, ease: 'power4.out' }, 4.95);
tl.to(leg.leg.rotation, { z: -0.12, duration: 0.6, ease: 'power2.inOut' }, 4.7);

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
tl.to(leg.material, { opacity: 0, duration: 1.2, ease: 'power2.out' }, 6.6);

// Logo fade in
tl.to('#logo', {
  opacity: 1, scale: 1, filter: 'blur(0px)',
  duration: 1.5, ease: 'power3.out'
}, 6.8);
tl.to('#tagline', {
  opacity: 0.7, duration: 1.2, ease: 'power2.out'
}, 7.6);

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
