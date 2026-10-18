import * as THREE from 'three';
import { loftGeometry, roundedBox, bolt, ring, placeOnTop } from './parts.js';

export const HULL_Y = 0.705;

// hull cross-sections, front -> back. w is HALF width.
const STATIONS = [
  { z: 0.535, w: 0.136, top: 0.062, bot: -0.096 },
  { z: 0.512, w: 0.154, top: 0.070, bot: -0.102 },
  { z: 0.470, w: 0.178, top: 0.086, bot: -0.110 },
  { z: 0.400, w: 0.196, top: 0.104, bot: -0.117 },
  { z: 0.300, w: 0.207, top: 0.123, bot: -0.123 },
  { z: 0.180, w: 0.214, top: 0.140, bot: -0.127 },
  { z: 0.050, w: 0.216, top: 0.150, bot: -0.129 },
  { z: -0.080, w: 0.214, top: 0.157, bot: -0.127 },
  { z: -0.200, w: 0.208, top: 0.166, bot: -0.122 },
  { z: -0.320, w: 0.196, top: 0.176, bot: -0.113 },
  { z: -0.420, w: 0.176, top: 0.182, bot: -0.098 },
  { z: -0.490, w: 0.150, top: 0.174, bot: -0.082 },
  { z: -0.535, w: 0.118, top: 0.148, bot: -0.064 },
];

const CROWN = 0.0075;

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export function stationAt(z) {
  if (z >= STATIONS[0].z) return STATIONS[0];
  const last = STATIONS[STATIONS.length - 1];
  if (z <= last.z) return last;
  for (let i = 0; i < STATIONS.length - 1; i++) {
    const a = STATIONS[i];
    const b = STATIONS[i + 1];
    if (z <= a.z && z >= b.z) {
      const t = (a.z - z) / (a.z - b.z);
      return {
        z,
        w: a.w + (b.w - a.w) * t,
        top: a.top + (b.top - a.top) * t,
        bot: a.bot + (b.bot - a.bot) * t,
      };
    }
  }
  return last;
}

export function surfaceTopY(x, z) {
  const st = stationAt(z);
  const h = st.top - st.bot;
  const xn = Math.min(1, Math.abs(x) / (0.8 * st.w));
  let y = st.top + CROWN * (1 - 0.55 * xn * xn);
  if (Math.abs(x) > 0.8 * st.w) {
    const t = Math.min(1, (Math.abs(x) - 0.8 * st.w) / (0.16 * st.w));
    y -= t * t * 0.028 * (h / 0.3);
  }
  return y;
}

export function topNormalAt(x, z) {
  const e = 0.004;
  const dx = (surfaceTopY(x + e, z) - surfaceTopY(x - e, z)) / (2 * e);
  const dz = (surfaceTopY(x, z + e) - surfaceTopY(x, z - e)) / (2 * e);
  return new THREE.Vector3(-dx, 1, -dz).normalize();
}

function hullRing(st) {
  const { w, top, bot } = st;
  const h = top - bot;
  const right = [
    [0, top + CROWN],
    [0.40 * w, top + CROWN * 0.72],
    [0.78 * w, top + CROWN * 0.30],
    [0.925 * w, top - h * 0.055],
    [w, top - h * 0.19],
    [w * 0.998, top - h * 0.40],
    [w * 0.986, top - h * 0.60],
    [w * 0.955, bot + h * 0.31],
    [w * 0.865, bot + h * 0.105],
    [w * 0.63, bot + h * 0.012],
    [0, bot],
  ];
  const pts = right.map(([x, y]) => new THREE.Vector3(x, y, st.z));
  for (let i = right.length - 2; i >= 1; i--) {
    pts.push(new THREE.Vector3(-right[i][0], right[i][1], st.z));
  }
  return pts;
}

function mesh(geo, material, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

/* ------------------------------------------------------------------
   Canopy plates
------------------------------------------------------------------ */

function plateWidth(z, factor, taperAmt = 0.055) {
  const st = stationAt(z);
  return st.w * factor;
}

function buildPlate({
  z0,
  z1,
  factor,
  lift,
  wallBottom,
  material,
  taper = 0.10,
  nz = 22,
  nx = 13,
}) {
  const group = new THREE.Group();
  const topPositions = [];
  const topUVs = [];
  const topIndices = [];
  const zs = [];
  const widths = [];

  for (let iz = 0; iz < nz; iz++) {
    const u = iz / (nz - 1);
    const z = z0 + (z1 - z0) * u;
    const endTaper = smoothstep(0, taper, u) * smoothstep(0, taper, 1 - u);
    const hw = plateWidth(z, factor) * (0.97 + 0.03 * endTaper);
    zs.push(z);
    widths.push(hw);
    for (let ix = 0; ix < nx; ix++) {
      const v = ix / (nx - 1);
      const x = -hw + 2 * hw * v;
      const y = surfaceTopY(x, z) + lift;
      topPositions.push(x, y, z);
      topUVs.push(x / 0.095, z / 0.095);
    }
  }
  for (let iz = 0; iz < nz - 1; iz++) {
    for (let ix = 0; ix < nx - 1; ix++) {
      const a = iz * nx + ix;
      const b = a + 1;
      const c = a + nx + 1;
      const d = a + nx;
      topIndices.push(a, b, c, a, c, d);
    }
  }

  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(topPositions, 3));
  topGeo.setAttribute('uv', new THREE.Float32BufferAttribute(topUVs, 2));
  topGeo.setIndex(topIndices);
  topGeo.computeVertexNormals();
  const topMesh = mesh(topGeo, material);
  group.add(topMesh);

  // side / end walls so the plate reads as a real raised panel
  const wallPos = [];
  const wallUV = [];
  const wallIdx = [];
  const pushQuad = (p0, p1, p2, p3, uvScale = 0.095) => {
    const base = wallPos.length / 3;
    const quad = [p0, p1, p2, p3];
    for (const p of quad) {
      wallPos.push(p.x, p.y, p.z);
      wallUV.push(p.x / uvScale, p.z / uvScale);
    }
    wallIdx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };

  for (let iz = 0; iz < nz; iz++) {
    const z = zs[iz];
    const hw = widths[iz];
    for (const side of [-1, 1]) {
      const x = side * hw;
      const yTop = surfaceTopY(x, z) + lift;
      const yBot = surfaceTopY(x, z) + wallBottom;
      if (iz < nz - 1) {
        const z2 = zs[iz + 1];
        const hw2 = widths[iz + 1];
        const x2 = side * hw2;
        const yTop2 = surfaceTopY(x2, z2) + lift;
        const yBot2 = surfaceTopY(x2, z2) + wallBottom;
        const p0 = new THREE.Vector3(x, yTop, z);
        const p1 = new THREE.Vector3(x, yBot, z);
        const p2 = new THREE.Vector3(x2, yBot2, z2);
        const p3 = new THREE.Vector3(x2, yTop2, z2);
        if (side > 0) pushQuad(p0, p1, p2, p3);
        else pushQuad(p3, p2, p1, p0);
      }
    }
  }

  // front and back end walls
  const endWall = (iz, forward) => {
    const z = zs[iz];
    const hw = widths[iz];
    for (let ix = 0; ix < nx - 1; ix++) {
      const xa = -hw + (2 * hw * ix) / (nx - 1);
      const xb = -hw + (2 * hw * (ix + 1)) / (nx - 1);
      const ya = surfaceTopY(xa, z) + lift;
      const yb = surfaceTopY(xb, z) + lift;
      const ba = surfaceTopY(xa, z) + wallBottom;
      const bb = surfaceTopY(xb, z) + wallBottom;
      const p0 = new THREE.Vector3(xa, ya, z);
      const p1 = new THREE.Vector3(xb, yb, z);
      const p2 = new THREE.Vector3(xb, bb, z);
      const p3 = new THREE.Vector3(xa, ba, z);
      if (forward) pushQuad(p0, p1, p2, p3);
      else pushQuad(p3, p2, p1, p0);
    }
  };
  endWall(nz - 1, true);
  endWall(0, false);

  const wallGeo = new THREE.BufferGeometry();
  wallGeo.setAttribute('position', new THREE.Float32BufferAttribute(wallPos, 3));
  wallGeo.setAttribute('uv', new THREE.Float32BufferAttribute(wallUV, 2));
  wallGeo.setIndex(wallIdx);
  wallGeo.computeVertexNormals();
  const wallMesh = mesh(wallGeo, material);
  group.add(wallMesh);

  return group;
}

/* ------------------------------------------------------------------
   Lenses
------------------------------------------------------------------ */

function makeLens(mats, tex, radius = 0.037, depth = 0.015) {
  const g = new THREE.Group();

  const barrelGeo = new THREE.CylinderGeometry(radius, radius * 1.02, depth, 36, 1);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = mesh(barrelGeo, mats.trim);
  barrel.position.z = depth * 0.5 - 0.004;
  g.add(barrel);

  const bezel = ring(radius * 0.985, radius * 0.105, mats.darkMetal, 40);
  bezel.position.z = depth - 0.002;
  g.add(bezel);

  const glassGeo = new THREE.SphereGeometry(radius * 0.82, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.34);
  glassGeo.rotateX(Math.PI / 2);
  glassGeo.scale(1, 1, 0.55);
  const glass = mesh(glassGeo, mats.glassGreen);
  glass.position.z = depth - 0.001;
  g.add(glass);

  const iris = mesh(new THREE.CircleGeometry(radius * 0.42, 32), mats.lensIris);
  iris.position.z = depth + 0.0045;
  g.add(iris);

  const irisRing = ring(radius * 0.44, 0.0012, mats.darkMetal, 36);
  irisRing.position.z = depth + 0.006;
  g.add(irisRing);

  const glintMat = mats.glassGlint.clone();
  glintMat.opacity = 0.32;
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(radius * 1.45, radius * 1.45), glintMat);
  glint.position.set(-radius * 0.22, radius * 0.22, depth + 0.007);
  glint.renderOrder = 3;
  g.add(glint);

  return g;
}

/* ------------------------------------------------------------------
   Body
------------------------------------------------------------------ */

export function buildBody(mats, tex) {
  const group = new THREE.Group();
  group.name = 'body';

  const rings = STATIONS.map((st) => hullRing(st));

  // Build the fuselage from separate panels so the shoulder, top deck and
  // lower shell meet in crisp moulded-composite creases instead of one
  // over-smoothed blob.
  const pick = (ring, idxs) => idxs.map((i) => ring[i].clone());
  const topDeck = rings.map((r) => pick(r, [18, 19, 0, 1, 2]));
  const shoulderR = rings.map((r) => pick(r, [2, 3, 4]));
  const shoulderL = rings.map((r) => pick(r, [16, 17, 18]));
  const lower = rings.map((r) => pick(r, [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]));

  const hullGroup = new THREE.Group();
  const makeStrip = (ringsArr, mat, uvScale = 0.17) => {
    const g = loftGeometry(ringsArr, {
      closed: false,
      capStart: false,
      capEnd: false,
      uvMode: 'arc',
      uvScale,
    });
    const m = mesh(g, mat);
    hullGroup.add(m);
    return m;
  };
  makeStrip(topDeck, mats.hull, 0.16);
  makeStrip(shoulderR, mats.hull, 0.16);
  makeStrip(shoulderL, mats.hull, 0.16);
  makeStrip(lower, mats.hullDark, 0.19);

  // flat nose and tail caps
  const makeCap = (ring, front) => {
    const positions = [];
    const uvs = [];
    const indices = [];
    const center = new THREE.Vector3();
    ring.forEach((p) => center.add(p));
    center.multiplyScalar(1 / ring.length);
    for (const p of ring) {
      positions.push(p.x, p.y, p.z);
      uvs.push(p.x / 0.17, p.y / 0.17);
    }
    positions.push(center.x, center.y, center.z);
    uvs.push(center.x / 0.17, center.y / 0.17);
    const cIdx = ring.length;
    for (let i = 0; i < ring.length; i++) {
      const a = i;
      const b = (i + 1) % ring.length;
      if (front) indices.push(cIdx, b, a);
      else indices.push(cIdx, a, b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    g.setIndex(indices);
    g.computeVertexNormals();
    const m = mesh(g, mats.hullDark);
    hullGroup.add(m);
  };
  makeCap(rings[0], true);
  makeCap(rings[rings.length - 1], false);
  const hull = hullGroup;
  group.add(hullGroup);

  // ---------------------------------------------------------------- canopy
  const plateDefs = [
    { z0: 0.450, z1: 0.168, factor: 0.695, lift: 0.0105, taper: 0.10 },
    { z0: 0.135, z1: -0.312, factor: 0.705, lift: 0.0115, taper: 0.075 },
    { z0: -0.332, z1: -0.498, factor: 0.65, lift: 0.0105, taper: 0.12 },
  ];

  for (const def of plateDefs) {
    const gasket = buildPlate({
      ...def,
      factor: def.factor + 0.045,
      lift: Math.max(0.0045, def.lift - 0.0045),
      wallBottom: 0.0004,
      material: mats.trim,
      taper: def.taper + 0.02,
    });
    group.add(gasket);
    const plate = buildPlate({
      ...def,
      wallBottom: Math.max(0.002, def.lift - 0.0045),
      material: mats.carbon,
    });
    group.add(plate);
  }

  // top logo
  const logoZ = 0.325;
  const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.128, 0.128), mats.logo);
  logo.position.set(0, surfaceTopY(0, logoZ) + 0.0128, logoZ);
  placeOnTop(logo, topNormalAt(0, logoZ));
  logo.renderOrder = 3;
  group.add(logo);

  // top intake grille
  const ventZ = -0.098;
  const ventY = surfaceTopY(0, ventZ);
  const ventFrame = roundedBox(0.163, 0.007, 0.083, 0.01, 2, mats.trim);
  ventFrame.position.set(0, ventY + 0.0115, ventZ);
  group.add(ventFrame);
  const slatMat = mats.darkMetal;
  for (let i = 0; i < 7; i++) {
    const s = roundedBox(0.132, 0.0045, 0.0052, 0.0018, 1, slatMat);
    s.position.set(0, ventY + 0.0158, ventZ - 0.033 + i * 0.011);
    s.rotation.x = -0.18;
    group.add(s);
  }
  for (const [x, z] of [
    [-0.135, 0.43],
    [0.135, 0.43],
    [-0.145, -0.30],
    [0.145, -0.30],
  ]) {
    const b = bolt(0.0052, 0.003, mats.darkMetal, 10);
    b.position.set(x, surfaceTopY(x, z) + 0.0132, z);
    group.add(b);
  }

  // ---------------------------------------------------------------- rear power pod
  const podZ = -0.427;
  const podY = surfaceTopY(0, podZ) + 0.007;
  const podBase = roundedBox(0.202, 0.027, 0.142, 0.022, 3, mats.trim);
  podBase.position.set(0, podY + 0.013, podZ);
  group.add(podBase);

  const podTop = roundedBox(0.172, 0.015, 0.112, 0.016, 2, mats.plastic);
  podTop.position.set(0, podY + 0.032, podZ);
  group.add(podTop);

  const button = mesh(new THREE.CylinderGeometry(0.037, 0.0385, 0.009, 36), mats.plasticSoft);
  button.position.set(0, podY + 0.0425, podZ);
  group.add(button);
  const buttonRing = ring(0.0395, 0.002, mats.darkMetal, 40);
  buttonRing.rotation.x = -Math.PI / 2;
  buttonRing.position.set(0, podY + 0.046, podZ);
  group.add(buttonRing);

  const power = new THREE.Mesh(new THREE.PlaneGeometry(0.056, 0.056), mats.powerIcon);
  power.rotation.x = -Math.PI / 2;
  power.position.set(0, podY + 0.0478, podZ);
  power.renderOrder = 4;
  group.add(power);

  for (const [x, z] of [
    [-0.078, podZ - 0.046],
    [0.078, podZ - 0.046],
    [-0.078, podZ + 0.046],
    [0.078, podZ + 0.046],
  ]) {
    const b = bolt(0.0044, 0.0024, mats.darkMetal, 8);
    b.position.set(x, podY + 0.021, z);
    group.add(b);
  }

  // ---------------------------------------------------------------- shoulder vents
  const shoulderVent = (z, sign) => {
    const st = stationAt(z);
    const p = new THREE.Vector3(sign * st.w * 0.955, st.top - 0.034, z);
    const n = new THREE.Vector3(sign * 0.78, 0.62, 0).normalize();
    p.addScaledVector(n, 0.0035);
    const vent = new THREE.Mesh(new THREE.PlaneGeometry(0.10, 0.058), mats.vent);
    vent.position.copy(p);
    vent.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    vent.renderOrder = 2;
    group.add(vent);
  };
  shoulderVent(0.185, 1);
  shoulderVent(0.185, -1);
  shoulderVent(-0.225, 1);
  shoulderVent(-0.225, -1);

  // ---------------------------------------------------------------- front mask
  const frontSt = STATIONS[0];
  const cy = (frontSt.top + frontSt.bot) / 2;

  // angular, chamfered sensor shield
  const outline = [
    [-0.124, cy + 0.016],
    [-0.104, cy + 0.06],
    [-0.042, cy + 0.074],
    [0.042, cy + 0.074],
    [0.104, cy + 0.06],
    [0.124, cy + 0.016],
    [0.116, cy - 0.05],
    [0.081, cy - 0.083],
    [-0.081, cy - 0.083],
    [-0.116, cy - 0.05],
  ];
  let area = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    area += a[0] * b[1] - b[0] * a[1];
  }
  if (area < 0) outline.reverse();
  const faceShape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  const faceGeo = new THREE.ExtrudeGeometry(faceShape, {
    depth: 0.007,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.0035,
    bevelSegments: 2,
    curveSegments: 1,
  });
  const frontMask = mesh(faceGeo, mats.hullDark);
  frontMask.position.z = 0.528;
  group.add(frontMask);

  // brow shading the sensor cluster
  const brow = roundedBox(0.205, 0.014, 0.042, 0.007, 2, mats.trim);
  brow.position.set(0, cy + 0.078, 0.525);
  brow.rotation.x = -0.1;
  group.add(brow);

  // recessed darker lens tray
  const tray = roundedBox(0.196, 0.06, 0.012, 0.022, 3, mats.trim);
  tray.position.set(0, cy + 0.006, 0.538);
  tray.scale.set(1, 1, 1);
  group.add(tray);

  const lensY = cy + 0.016;
  const lensR = 0.031;
  const lensDefs = [
    { x: -0.082, y: lensY - 0.003, r: lensR },
    { x: 0, y: lensY + 0.014, r: lensR * 0.91 },
    { x: 0.082, y: lensY - 0.003, r: lensR },
  ];
  for (const l of lensDefs) {
    const lens = makeLens(mats, tex, l.r, 0.014);
    lens.position.set(l.x, l.y, 0.544);
    lens.traverse((o) => { if (o.isMesh) o.castShadow = false; });
    group.add(lens);
  }
  // small auxiliary apertures
  for (const x of [-0.045, 0.045]) {
    const dot = mesh(new THREE.CylinderGeometry(0.0052, 0.0058, 0.006, 16), mats.glass);
    dot.rotation.x = Math.PI / 2;
    dot.position.set(x, cy - 0.052, 0.546);
    group.add(dot);
  }
  for (const x of [-0.098, 0.098]) {
    const s = bolt(0.0042, 0.002, mats.darkMetal, 8);
    s.rotation.x = Math.PI / 2;
    s.position.set(x, cy + 0.062, 0.545);
    group.add(s);
  }

  // thin chin lip under the sensor mask
  const chin = roundedBox(0.16, 0.018, 0.03, 0.008, 2, mats.trim);
  chin.position.set(0, cy - 0.093, 0.522);
  chin.rotation.x = 0.22;
  group.add(chin);

  // ---------------------------------------------------------------- belly
  const belly = roundedBox(0.152, 0.011, 0.21, 0.02, 2, mats.trim);
  belly.position.set(0, STATIONS[6].bot + 0.002, 0.02);
  group.add(belly);
  for (const [x, z] of [
    [-0.056, 0.105],
    [0.056, 0.105],
    [-0.056, -0.065],
    [0.056, -0.065],
  ]) {
    const b = bolt(0.0042, 0.002, mats.darkMetal, 8);
    b.position.set(x, STATIONS[6].bot + 0.009, z);
    group.add(b);
  }

  // battery latch at the tail underside
  const latch = roundedBox(0.085, 0.018, 0.04, 0.008, 2, mats.plasticSoft);
  latch.position.set(0, -0.112, -0.468);
  group.add(latch);

  // ---------------------------------------------------------------- panel seams
  const seamMat = mats.trim;
  for (const sign of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 40; i++) {
      const z = 0.46 - (i / 40) * 0.93;
      const st = stationAt(z);
      pts.push(new THREE.Vector3(sign * st.w * 0.999, -0.012, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const seam = new THREE.Mesh(new THREE.TubeGeometry(curve, 90, 0.0016, 4, false), seamMat);
    group.add(seam);
  }

  // shoulder crease follows the widest line of the hull
  for (const sign of [-1, 1]) {
    const pts = [];
    for (let i = 0; i <= 32; i++) {
      const z = 0.5 - (i / 32) * 1.01;
      const st = stationAt(z);
      const h = st.top - st.bot;
      pts.push(new THREE.Vector3(sign * st.w * 0.996, st.top - h * 0.19, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const seam = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.0015, 4, false), seamMat);
    group.add(seam);
  }

  const addVerticalSeam = (z, sign) => {
    const st = stationAt(z);
    const pts = [];
    const ys = [
      st.top - (st.top - st.bot) * 0.05,
      st.top - (st.top - st.bot) * 0.2,
      st.top - (st.top - st.bot) * 0.42,
      -0.012,
    ];
    for (const y of ys) {
      const frac = (st.top - y) / (st.top - st.bot);
      let wf = 0.998;
      if (frac > 0.75) wf = 0.96;
      else if (frac > 0.55) wf = 0.99;
      pts.push(new THREE.Vector3(sign * st.w * wf, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const seam = new THREE.Mesh(new THREE.TubeGeometry(curve, 24, 0.0015, 4, false), seamMat);
    group.add(seam);
  };
  for (const sign of [-1, 1]) {
    addVerticalSeam(0.148, sign);
    addVerticalSeam(-0.325, sign);
    addVerticalSeam(-0.51, sign);
  }

  // ---------------------------------------------------------------- rear face details
  const rearPlate = roundedBox(0.106, 0.048, 0.008, 0.01, 2, mats.trim);
  rearPlate.position.set(0, 0.03, -0.535);
  group.add(rearPlate);
  for (let i = 0; i < 3; i++) {
    const s = roundedBox(0.078, 0.003, 0.0035, 0.001, 1, mats.darkMetal);
    s.position.set(0, 0.043 - i * 0.0105, -0.540);
    group.add(s);
  }
  const usb = roundedBox(0.028, 0.010, 0.006, 0.004, 2, mats.glass);
  usb.position.set(0, -0.032, -0.538);
  group.add(usb);

  // gimbal mounting boss under the nose
  const gimbalBoss = roundedBox(0.108, 0.022, 0.098, 0.018, 2, mats.trim);
  gimbalBoss.position.set(0, STATIONS[4].bot - 0.004, 0.30);
  group.add(gimbalBoss);
  const bossRing = ring(0.048, 0.005, mats.darkMetal, 32);
  bossRing.rotation.x = Math.PI / 2;
  bossRing.position.set(0, STATIONS[4].bot - 0.017, 0.30);
  group.add(bossRing);

  // gear hardpoints
  for (const [x, z] of [
    [-0.177, 0.335],
    [0.177, 0.335],
    [-0.177, -0.34],
    [0.177, -0.34],
  ]) {
    const mount = roundedBox(0.07, 0.032, 0.115, 0.014, 2, mats.trim);
    mount.position.set(x, STATIONS[6].bot - 0.008, z);
    mount.rotation.z = x > 0 ? 0.08 : -0.08;
    group.add(mount);
  }

  group.position.y = HULL_Y;

  return {
    group,
    surfaceTopY,
    topNormalAt,
    hull,
    lensY,
    frontZ: 0.535,
  };
}
