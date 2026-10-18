import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, t) => {
  const x = clamp((t - a) / (b - a), 0, 1);
  return x * x * (3 - 2 * x);
};
const signedPow = (value, power) => Math.sign(value) * Math.pow(Math.abs(value), power);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

// One-dimensional shape-preserving cubic interpolation. The control stations for
// a hull are deliberately non-uniform; sampling a generic 3D spline by index would
// move every value to the wrong longitudinal station.
function curveFromPairs(pairs) {
  const data = pairs
    .map(([x, y]) => [x, y])
    .sort((a, b) => a[0] - b[0]);
  const n = data.length;
  const xs = data.map((p) => p[0]);
  const ys = data.map((p) => p[1]);
  const h = new Array(n - 1);
  const delta = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
    delta[i] = (ys[i + 1] - ys[i]) / h[i];
  }
  const slopes = new Array(n);
  slopes[0] = delta[0];
  slopes[n - 1] = delta[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (delta[i - 1] * delta[i] <= 0) {
      slopes[i] = 0;
    } else {
      const w1 = 2 * h[i] + h[i - 1];
      const w2 = h[i] + 2 * h[i - 1];
      slopes[i] = (w1 + w2) / (w1 / delta[i - 1] + w2 / delta[i]);
    }
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (xs[mid] <= t) lo = mid;
      else hi = mid;
    }
    const interval = h[lo];
    const u = (t - xs[lo]) / interval;
    const u2 = u * u;
    const u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1;
    const h10 = u3 - 2 * u2 + u;
    const h01 = -2 * u3 + 3 * u2;
    const h11 = u3 - u2;
    return h00 * ys[lo] + h10 * interval * slopes[lo] + h01 * ys[lo + 1] + h11 * interval * slopes[lo + 1];
  };
}

function sampleCurve(curve, t) {
  return curve(clamp(t, 0, 1));
}

function addMesh(parent, geometry, material, options = {}) {
  const mesh = new THREE.Mesh(geometry, material);
  if (options.position) mesh.position.copy(options.position);
  if (options.rotation) mesh.rotation.set(options.rotation.x || 0, options.rotation.y || 0, options.rotation.z || 0);
  if (options.castShadow !== undefined) mesh.castShadow = options.castShadow;
  if (options.receiveShadow !== undefined) mesh.receiveShadow = options.receiveShadow;
  if (options.name) mesh.name = options.name;
  parent.add(mesh);
  return mesh;
}

function roundedBox(parent, w, h, d, radius, material, x = 0, y = 0, z = 0, segments = 3) {
  const geometry = new RoundedBoxGeometry(w, h, d, segments, Math.min(radius, w * 0.48, h * 0.48, d * 0.48));
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function cylinderBetween(parent, a, b, radius, material, radialSegments = 8, taper = 1, castShadow = true) {
  const direction = new THREE.Vector3().subVectors(b, a);
  const length = direction.length();
  const geometry = new THREE.CylinderGeometry(radius * taper, radius, length, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(V(0, 1, 0), direction.normalize());
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function tubeFromPoints(parent, points, radius, material, tubularSegments = 64, radialSegments = 5, closed = false, castShadow = true) {
  if (points.length < 2) return null;
  const curve = new THREE.CatmullRomCurve3(points.map((p) => (p.isVector3 ? p.clone() : V(...p))), closed, 'catmullrom', 0.35);
  const geometry = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function makeLathe(parent, profile, segments, material, position = V(), castShadow = true) {
  const points = profile.map(([x, y]) => new THREE.Vector2(x, y));
  const geometry = new THREE.LatheGeometry(points, segments);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// Vessel reference lines ----------------------------------------------------
// +Z is the bow, +X is starboard, +Y is up. One modelling unit is one metre.
const LENGTH = 9.10;
const Z_STERN = -4.55;
const Z_BOW = Z_STERN + LENGTH;

const stationControl = [
  [0.0000, 0.970, -0.430, 0.600],
  [0.0350, 1.120, -0.505, 0.612],
  [0.1000, 1.270, -0.575, 0.625],
  [0.2000, 1.360, -0.625, 0.640],
  [0.3100, 1.395, -0.635, 0.655],
  [0.4100, 1.385, -0.620, 0.675],
  [0.5100, 1.330, -0.585, 0.705],
  [0.6000, 1.240, -0.530, 0.735],
  [0.6900, 1.100, -0.460, 0.780],
  [0.7700, 0.940, -0.380, 0.835],
  [0.8400, 0.780, -0.300, 0.895],
  [0.8950, 0.600, -0.220, 0.955],
  [0.9350, 0.450, -0.150, 1.015],
  [0.9650, 0.320, -0.085, 1.070],
  [0.9850, 0.190, -0.020, 1.120],
  [0.9970, 0.075, 0.030, 1.155],
  [1.0000, 0.0015, 0.060, 1.170]
];

const widthCurve = curveFromPairs(stationControl.map((s) => [s[0], s[1]]), 0.16);
const keelCurve = curveFromPairs(stationControl.map((s) => [s[0], s[2]]), 0.22);
const sheerCurve = curveFromPairs(stationControl.map((s) => [s[0], s[3]]), 0.22);

const sectionControl = [
  [0.000, 0.000],
  [0.035, 0.130],
  [0.080, 0.275],
  [0.145, 0.450],
  [0.225, 0.610],
  [0.320, 0.750],
  [0.410, 0.850],
  [0.510, 0.920],
  [0.620, 0.970],
  [0.730, 0.994],
  [0.830, 1.000],
  [0.920, 0.993],
  [1.000, 0.982]
];
const sectionCurve = curveFromPairs(sectionControl, 0.25);

function stationAt(s) {
  const ss = clamp(s, 0, 1);
  return {
    s: ss,
    z: Z_STERN + ss * LENGTH,
    width: Math.max(0.0015, sampleCurve(widthCurve, ss)),
    keel: sampleCurve(keelCurve, ss),
    sheer: sampleCurve(sheerCurve, ss)
  };
}

function zToS(z) {
  return clamp((z - Z_STERN) / LENGTH, 0, 1);
}

function deckHalfWidth(s) {
  return stationAt(s).width * sampleCurve(sectionCurve, 1) - 0.002;
}

function deckCrown(s, xFraction = 0) {
  return 0.033 * (1 - clamp(xFraction * xFraction, 0, 1));
}

function deckSurfaceY(s, x = 0) {
  const station = stationAt(s);
  const halfWidth = Math.max(0.001, station.width * sampleCurve(sectionCurve, 1));
  return station.sheer + deckCrown(s, x / halfWidth);
}

function hullPoint(s, u, side, expand = 0) {
  const station = stationAt(s);
  const uu = clamp(u, 0, 1);
  const widthFactor = sampleCurve(sectionCurve, uu);
  return V(
    side * station.width * widthFactor * (1 + expand),
    station.keel + (station.sheer - station.keel) * uu,
    station.z
  );
}

function hullPointAtY(s, y, side, expand = 0) {
  const station = stationAt(s);
  const u = clamp((y - station.keel) / Math.max(0.001, station.sheer - station.keel), 0, 1);
  return hullPoint(s, u, side, expand);
}

function sideRailY(s, inset, extra = 0) {
  const station = stationAt(s);
  const halfWidth = Math.max(0.001, station.width * sampleCurve(sectionCurve, 1));
  const x = Math.max(0, halfWidth - inset);
  return deckSurfaceY(s, x) + extra;
}

// Hull -----------------------------------------------------------------------
function buildHull(materials) {
  const group = new THREE.Group();
  group.name = 'CHINE — vacuum-infused monohull';

  const SEGMENTS = 180;
  const ROUNDS = 32;
  const positions = [];
  const uvs = [];
  const navy = [];
  const white = [];

  for (const side of [1, -1]) {
    const base = positions.length / 3;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      for (let j = 0; j <= ROUNDS; j++) {
        const u = j / ROUNDS;
        const point = hullPoint(s, u, side);
        positions.push(point.x, point.y, point.z);
        uvs.push(s, u);
      }
    }

    for (let i = 0; i < SEGMENTS; i++) {
      for (let j = 0; j < ROUNDS; j++) {
        const a = base + i * (ROUNDS + 1) + j;
        const b = base + (i + 1) * (ROUNDS + 1) + j;
        const c = base + i * (ROUNDS + 1) + j + 1;
        const d = base + (i + 1) * (ROUNDS + 1) + j + 1;
        const yAvg = (
          positions[a * 3 + 1] +
          positions[b * 3 + 1] +
          positions[c * 3 + 1] +
          positions[d * 3 + 1]
        ) / 4;
        const target = yAvg < 0.024 ? navy : white;
        if (side === 1) {
          target.push(a, c, b, b, c, d);
        } else {
          target.push(a, b, c, b, d, c);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex([...navy, ...white]);
  geometry.addGroup(0, navy.length, 0);
  geometry.addGroup(navy.length, white.length, 1);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, [materials.lowerHull, materials.pearlWhite]);
  mesh.name = 'Hull shell';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  return { group, mesh };
}

function buildTransom(materials) {
  const group = new THREE.Group();
  group.name = 'Transom';
  const station = stationAt(0);
  const U = 28;
  const widthAt = (u) => station.width * sampleCurve(sectionCurve, u);

  const upper = new THREE.Shape();
  const waterY = 0.027;
  const uWater = clamp((waterY - station.keel) / (station.sheer - station.keel), 0.001, 0.99);
  const waterWidth = widthAt(uWater);

  upper.moveTo(-waterWidth, waterY);
  for (let i = 0; i <= 14; i++) {
    const u = lerp(uWater, 1, i / 14);
    upper.lineTo(-widthAt(u), lerp(waterY, station.sheer, i / 14));
  }
  for (let i = 0; i <= 14; i++) {
    const u = lerp(1, uWater, i / 14);
    upper.lineTo(widthAt(u), lerp(station.sheer, waterY, i / 14));
  }
  upper.closePath();

  const upperGeometry = new THREE.ShapeGeometry(upper, 24);
  upperGeometry.rotateY(Math.PI);
  const upperMesh = new THREE.Mesh(upperGeometry, materials.pearlWhite);
  upperMesh.position.z = Z_STERN - 0.002;
  upperMesh.castShadow = true;
  upperMesh.receiveShadow = true;
  group.add(upperMesh);

  const lower = new THREE.Shape();
  lower.moveTo(0, station.keel);
  lower.lineTo(-waterWidth, waterY);
  lower.lineTo(waterWidth, waterY);
  lower.closePath();
  const lowerGeometry = new THREE.ShapeGeometry(lower, 12);
  lowerGeometry.rotateY(Math.PI);
  const lowerMesh = new THREE.Mesh(lowerGeometry, materials.lowerHull);
  lowerMesh.position.z = Z_STERN - 0.001;
  lowerMesh.castShadow = false;
  lowerMesh.receiveShadow = true;
  group.add(lowerMesh);

  // Broad transom rub strake.
  const trimPoints = [];
  for (let i = 0; i <= 36; i++) {
    const x = lerp(-widthAt(1) + 0.01, widthAt(1) - 0.01, i / 36);
    trimPoints.push(V(x, station.sheer + 0.008, Z_STERN - 0.012));
  }
  tubeFromPoints(group, trimPoints, 0.012, materials.polished, 32, 5, false, false);

  // Waterline stripe across the transom.
  const stripeGeo = new THREE.PlaneGeometry(waterWidth * 2.02, 0.046);
  const stripe = new THREE.Mesh(stripeGeo, materials.ember);
  stripe.position.set(0, 0.048, Z_STERN - 0.01);
  stripe.rotation.y = Math.PI;
  group.add(stripe);

  // Transom name decal.
  const decalGeometry = new THREE.PlaneGeometry(1.34, 0.47);
  const decal = new THREE.Mesh(decalGeometry, materials.transomDecal);
  decal.position.set(0, 0.305, Z_STERN - 0.012);
  decal.rotation.y = Math.PI;
  decal.renderOrder = 2;
  group.add(decal);

  return group;
}

function buildWaterlineStripe(materials) {
  const SEGMENTS = 180;
  const positions = [];
  const indices = [];
  const y0 = 0.018;
  const y1 = 0.066;

  for (const side of [1, -1]) {
    const base = positions.length / 3;
    for (let i = 0; i <= SEGMENTS; i++) {
      const s = i / SEGMENTS;
      const lower = hullPointAtY(s, y0, side, 0.0038);
      const upper = hullPointAtY(s, y1, side, 0.0038);
      positions.push(lower.x, lower.y, lower.z, upper.x, upper.y, upper.z);
    }
    for (let i = 0; i < SEGMENTS; i++) {
      const a = base + i * 2;
      const b = a + 2;
      const c = a + 1;
      const d = b + 1;
      if (side === 1) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, materials.ember);
  mesh.name = 'Waterline stripe';
  mesh.castShadow = false;
  return mesh;
}

function buildStem(materials) {
  const group = new THREE.Group();
  group.name = 'Single plumb stem';
  const line = [];
  for (let i = 0; i <= 16; i++) {
    const y = lerp(0.075, 1.166, i / 16);
    line.push(V(0, y, 4.552 + Math.sin(i / 16 * Math.PI) * 0.004));
  }
  tubeFromPoints(group, line, 0.013, materials.polished, 40, 6, false, false);

  // A fine shadow gap on the leading edge.
  const shadowLine = line.map((p) => V(p.x, p.y - 0.003, p.z + 0.004));
  tubeFromPoints(group, shadowLine, 0.018, materials.ink, 40, 5, false, false);

  return group;
}

function buildDeck(materials) {
  const S = 150;
  const K = 30;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= S; i++) {
    const s = i / S;
    const station = stationAt(s);
    const halfWidth = deckHalfWidth(s);
    for (let j = 0; j <= K; j++) {
      const q = j / K;
      const x = lerp(-halfWidth, halfWidth, q);
      const y = deckSurfaceY(s, x) + 0.003;
      positions.push(x, y, station.z);
      uvs.push(q, s * 2.05);
    }
  }

  for (let i = 0; i < S; i++) {
    for (let j = 0; j < K; j++) {
      const a = i * (K + 1) + j;
      const b = (i + 1) * (K + 1) + j;
      const c = i * (K + 1) + j + 1;
      const d = (i + 1) * (K + 1) + j + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  materials.teak.map.wrapT = THREE.RepeatWrapping;
  materials.teak.map.needsUpdate = true;

  const mesh = new THREE.Mesh(geometry, materials.teak);
  mesh.name = 'Teak deck';
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildSheerTrim(materials) {
  const group = new THREE.Group();
  group.name = 'Sheer line and rub rail';

  for (const side of [1, -1]) {
    const capPoints = [];
    const rubPoints = [];
    const capPositions = [];
    const capIndices = [];
    const capSamples = 120;
    for (let i = 0; i <= capSamples; i++) {
      const s = i / capSamples;
      const station = stationAt(s);
      const halfWidth = station.width * sampleCurve(sectionCurve, 1);
      const outerX = halfWidth + 0.002;
      const innerX = halfWidth - 0.065;
      capPositions.push(side * outerX, station.sheer + 0.008, station.z);
      capPositions.push(side * innerX, deckSurfaceY(s, innerX) + 0.005, station.z);
      capPoints.push(V(side * (halfWidth + 0.001), station.sheer + 0.008, station.z));
      rubPoints.push(V(side * (halfWidth + 0.006), station.sheer - 0.018, station.z));
    }
    for (let i = 0; i < capSamples; i++) {
      const a = i * 2;
      const b = (i + 1) * 2;
      const c = i * 2 + 1;
      const d = (i + 1) * 2 + 1;
      if (side === 1) capIndices.push(a, c, b, b, c, d);
      else capIndices.push(a, b, c, b, d, c);
    }
    const capGeometry = new THREE.BufferGeometry();
    capGeometry.setAttribute('position', new THREE.Float32BufferAttribute(capPositions, 3));
    capGeometry.setIndex(capIndices);
    capGeometry.computeVertexNormals();
    const capMesh = new THREE.Mesh(capGeometry, materials.pureWhite);
    capMesh.castShadow = true;
    capMesh.receiveShadow = true;
    group.add(capMesh);

    // A fine dark seam follows the inboard edge of the cap, meeting the teak field.
    const seam = [];
    for (let i = 0; i <= 90; i++) {
      const s = i / 90;
      const station = stationAt(s);
      const halfWidth = station.width * sampleCurve(sectionCurve, 1);
      const innerX = halfWidth - 0.065;
      seam.push(V(side * innerX, deckSurfaceY(s, innerX) + 0.007, station.z));
    }
    tubeFromPoints(group, seam, 0.0032, materials.ink, 110, 4, false, false);

    tubeFromPoints(group, capPoints, 0.0072, materials.polished, 130, 5, false, false);
    tubeFromPoints(group, rubPoints, 0.0155, materials.rubber, 130, 6, false, true);
  }

  // Wrap the sheer rubber around the transom.
  const sternS = stationAt(0);
  const sternPoints = [];
  for (let i = 0; i <= 24; i++) {
    const x = lerp(-sternS.width * 0.982, sternS.width * 0.982, i / 24);
    sternPoints.push(V(x, sternS.sheer - 0.018, Z_STERN - 0.006));
  }
  tubeFromPoints(group, sternPoints, 0.0155, materials.rubber, 40, 6, false, true);

  return group;
}

function buildHullStripeDetails(materials) {
  const group = new THREE.Group();
  group.name = 'Hull detailing';

  // Side discharge grilles, just aft of amidships.
  for (const side of [1, -1]) {
    const s = 0.165;
    const station = stationAt(s);
    const y = 0.31;
    const u = clamp((y - station.keel) / (station.sheer - station.keel), 0, 1);
    const point = hullPoint(s, u, side, 0.012);
    const vent = new THREE.Group();
    vent.position.copy(point);
    vent.rotation.y = side === 1 ? 0 : Math.PI;
    vent.rotation.z = -0.06;
    roundedBox(vent, 0.018, 0.13, 0.34, 0.006, materials.ink, 0, 0, 0, 2).castShadow = false;
    for (let i = 0; i < 5; i++) {
      roundedBox(vent, 0.011, 0.008, 0.27, 0.002, materials.brushed, 0.01, -0.047 + i * 0.023, 0, 1).castShadow = false;
    }
    group.add(vent);
  }

  // Transom underwater running gear.
  for (const side of [1, -1]) {
    const jet = new THREE.Group();
    jet.position.set(side * 0.45, -0.34, Z_STERN - 0.17);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.125, 0.34, 24), materials.titanium);
    barrel.rotation.x = Math.PI / 2;
    barrel.castShadow = true;
    jet.add(barrel);
    const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.13, 24), materials.darkMetal);
    nozzle.rotation.x = Math.PI / 2;
    nozzle.position.z = -0.22;
    nozzle.castShadow = true;
    jet.add(nozzle);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.012, 8, 24), materials.polished);
    ring.position.z = -0.275;
    jet.add(ring);
    // Reverse bucket.
    const bucket = roundedBox(jet, 0.22, 0.025, 0.17, 0.008, materials.darkMetal, 0, -0.12, -0.22, 2);
    bucket.rotation.x = -0.38;
    // Steering vane.
    const vane = roundedBox(jet, 0.018, 0.21, 0.17, 0.008, materials.ember, 0, 0.04, -0.29, 2);
    vane.rotation.z = side * 0.06;
    // Intake grille, visible when the camera is low.
    for (let i = 0; i < 4; i++) {
      roundedBox(jet, 0.15, 0.008, 0.025, 0.002, materials.darkMetal, 0, -0.035, 0.12 + i * 0.035, 1).castShadow = false;
    }
    group.add(jet);
  }

  // Bow eye.
  const bowEye = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.012, 8, 20, Math.PI * 1.25), materials.polished);
  bowEye.position.set(0, 0.14, 4.565);
  bowEye.rotation.set(0, Math.PI / 2, Math.PI * -0.125);
  group.add(bowEye);

  return group;
}


// Deck furniture -------------------------------------------------------------
function makeHatch(materials, width, depth, x, z, material = null, label = '') {
  const s = zToS(z);
  const y = deckSurfaceY(s, x);
  const slope = (deckSurfaceY(zToS(z + 0.05), x) - deckSurfaceY(zToS(z - 0.05), x)) / 0.1;
  const group = new THREE.Group();
  group.position.set(x, y + 0.004, z);
  group.rotation.x = -Math.atan(slope);
  group.name = label || 'Flush deck hatch';

  const gasket = roundedBox(group, width + 0.07, 0.012, depth + 0.07, 0.012, materials.rubber, 0, 0.008, 0, 2);
  gasket.castShadow = false;

  const lid = roundedBox(group, width, 0.03, depth, 0.018, material || materials.satinWhite, 0, 0.033, 0, 3);
  lid.name = 'Hatch lid';

  const inset = roundedBox(group, width - 0.055, 0.006, depth - 0.055, 0.01, materials.pureWhite, 0, 0.052, 0, 2);
  inset.castShadow = false;

  // Hinges and recessed pull.
  for (const side of [-1, 1]) {
    const hinge = roundedBox(group, 0.065, 0.012, 0.035, 0.004, materials.polished, side * width * 0.28, 0.052, -depth * 0.47, 1);
    hinge.castShadow = false;
  }
  const pull = roundedBox(group, 0.12, 0.012, 0.026, 0.006, materials.polished, 0, 0.054, depth * 0.38, 1);
  pull.castShadow = false;

  return group;
}

function makeCleat(materials) {
  const group = new THREE.Group();
  const points = [
    V(-0.085, 0.026, 0),
    V(-0.065, 0.052, 0),
    V(-0.022, 0.061, 0),
    V(0.022, 0.061, 0),
    V(0.065, 0.052, 0),
    V(0.085, 0.026, 0)
  ];
  tubeFromPoints(group, points, 0.0115, materials.polished, 28, 7, false, true);
  for (const side of [-1, 1]) {
    const base = addMesh(
      group,
      new THREE.CylinderGeometry(0.019, 0.023, 0.028, 14),
      materials.brushed,
      { position: V(side * 0.045, 0.014, 0) }
    );
    base.castShadow = true;
  }
  return group;
}

function placeDeckCleat(materials, x, z) {
  const s = zToS(z);
  const group = makeCleat(materials);
  group.position.set(x, deckSurfaceY(s, x) + 0.003, z);
  group.rotation.y = Math.PI / 2;
  return group;
}

function makeDeckFill(materials, x, z, radius = 0.055) {
  const s = zToS(z);
  const y = deckSurfaceY(s, x);
  const group = new THREE.Group();
  group.position.set(x, y + 0.004, z);
  const ring = addMesh(group, new THREE.CylinderGeometry(radius, radius, 0.012, 24), materials.brushed, { position: V(0, 0.006, 0) });
  ring.castShadow = false;
  const cap = addMesh(group, new THREE.CylinderGeometry(radius * 0.76, radius * 0.76, 0.014, 24), materials.polished, { position: V(0, 0.013, 0) });
  cap.castShadow = false;
  const key = roundedBox(group, radius * 0.9, 0.005, 0.011, 0.002, materials.ink, 0, 0.023, 0, 1);
  key.castShadow = false;
  return group;
}

function makeDeckRail(materials) {
  const group = new THREE.Group();
  group.name = 'Foredeck lifelines';

  const stanchionS = [0.70, 0.78, 0.86, 0.93, 0.972];
  for (const side of [1, -1]) {
    for (const s of stanchionS) {
      const station = stationAt(s);
      const half = station.width * sampleCurve(sectionCurve, 1);
      const x = side * Math.max(0.04, half - 0.082);
      const y = deckSurfaceY(s, x);
      const top = y + 0.515;
      const post = addMesh(
        group,
        new THREE.CylinderGeometry(0.0105, 0.013, 0.515, 10),
        materials.polished,
        { position: V(x, y + 0.258, station.z) }
      );
      post.castShadow = true;
      const foot = addMesh(
        group,
        new THREE.CylinderGeometry(0.025, 0.03, 0.014, 16),
        materials.brushed,
        { position: V(x, y + 0.011, station.z) }
      );
      foot.castShadow = false;
      const cap = addMesh(
        group,
        new THREE.SphereGeometry(0.014, 10, 8),
        materials.polished,
        { position: V(x, top, station.z) }
      );
      cap.castShadow = false;
    }

    for (const height of [0.515, 0.29]) {
      const points = [];
      for (let i = 0; i <= 50; i++) {
        const s = lerp(0.695, 0.992, i / 50);
        const station = stationAt(s);
        const half = station.width * sampleCurve(sectionCurve, 1);
        const x = side * Math.max(0.01, half - 0.082);
        const y = deckSurfaceY(s, x) + height;
        points.push(V(x, y, station.z));
      }
      const bowStation = stationAt(0.999);
      points.push(V(0, bowStation.sheer + height + 0.008, 4.537));
      const rail = tubeFromPoints(group, points, 0.0076, materials.polished, 100, 5, false, true);
      if (rail) rail.name = 'Lifeline';
    }
  }

  // Low pushpit across the transom.
  const sternY = stationAt(0).sheer;
  const pushPoints = [
    V(-0.79, sternY + 0.47, -4.3),
    V(-0.84, sternY + 0.5, -4.39),
    V(-0.5, sternY + 0.5, -4.43),
    V(0, sternY + 0.5, -4.44),
    V(0.5, sternY + 0.5, -4.43),
    V(0.84, sternY + 0.5, -4.39),
    V(0.79, sternY + 0.47, -4.3)
  ];
  tubeFromPoints(group, pushPoints, 0.0085, materials.polished, 50, 5, false, true);
  for (const side of [-1, 1]) {
    const post = addMesh(
      group,
      new THREE.CylinderGeometry(0.0105, 0.0125, 0.47, 10),
      materials.polished,
      { position: V(side * 0.79, sternY + 0.235, -4.3) }
    );
    post.castShadow = true;
    addMesh(group, new THREE.SphereGeometry(0.012, 8, 6), materials.polished, { position: V(side * 0.79, sternY + 0.47, -4.3) });
  }

  return group;
}

function makeForedeckHardware(materials) {
  const group = new THREE.Group();
  group.name = 'Foredeck hardware';

  // Anchor roller, slightly proud of the stem.
  const rollerGroup = new THREE.Group();
  const sRoller = zToS(4.18);
  const deckY = deckSurfaceY(sRoller, 0);
  rollerGroup.position.set(0, deckY + 0.005, 4.28);
  for (const side of [-1, 1]) {
    const cheek = roundedBox(rollerGroup, 0.018, 0.09, 0.58, 0.008, materials.polished, side * 0.06, 0.032, 0.11, 2);
    cheek.rotation.x = -0.07;
  }
  const roller = new THREE.Mesh(new THREE.CylinderGeometry(0.044, 0.044, 0.12, 20), materials.rubber);
  roller.rotation.z = Math.PI / 2;
  roller.position.set(0, 0.044, 0.385);
  roller.castShadow = true;
  rollerGroup.add(roller);
  const rollerAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.18, 12), materials.polished);
  rollerAxle.rotation.z = Math.PI / 2;
  rollerAxle.position.set(0, 0.044, 0.385);
  rollerGroup.add(rollerAxle);
  const bowBale = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.01, 8, 26, Math.PI), materials.polished);
  bowBale.position.set(0, 0.08, 0.39);
  bowBale.rotation.set(0, 0, Math.PI / 2);
  bowBale.rotation.y = Math.PI / 2;
  rollerGroup.add(bowBale);
  group.add(rollerGroup);

  // Stowed anchor shank and flukes.
  const anchor = new THREE.Group();
  anchor.position.set(0, deckY + 0.065, 4.01);
  const shank = roundedBox(anchor, 0.04, 0.045, 0.52, 0.015, materials.brushed, 0, 0.0, 0.19, 2);
  shank.rotation.x = -0.08;
  const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.36, 10), materials.brushed);
  stock.rotation.z = Math.PI / 2;
  stock.position.set(0, 0.015, 0.39);
  anchor.add(stock);
  for (const side of [-1, 1]) {
    const fluke = roundedBox(anchor, 0.14, 0.018, 0.22, 0.008, materials.brushed, side * 0.09, -0.012, 0.46, 2);
    fluke.rotation.y = -side * 0.48;
    fluke.rotation.z = side * 0.06;
  }
  group.add(anchor);

  // Windlass.
  const sWind = zToS(3.67);
  const windY = deckSurfaceY(sWind, 0);
  const windlass = new THREE.Group();
  windlass.position.set(0, windY + 0.003, 3.67);
  addMesh(windlass, new THREE.CylinderGeometry(0.17, 0.19, 0.035, 28), materials.brushed, { position: V(0, 0.018, 0) });
  addMesh(windlass, new THREE.CylinderGeometry(0.105, 0.135, 0.13, 24), materials.darkMetal, { position: V(0, 0.1, 0) });
  addMesh(windlass, new THREE.CylinderGeometry(0.13, 0.13, 0.025, 24), materials.polished, { position: V(0, 0.178, 0) });
  addMesh(windlass, new THREE.CylinderGeometry(0.038, 0.052, 0.055, 16), materials.polished, { position: V(0, 0.21, 0) });
  const gypsy = addMesh(windlass, new THREE.TorusGeometry(0.135, 0.022, 8, 28), materials.darkMetal, { position: V(0, 0.035, 0) });
  gypsy.rotation.x = Math.PI / 2;
  group.add(windlass);

  // Anchor chain, sampled as fine links along a catenary.
  const chainCurve = new THREE.CatmullRomCurve3([
    V(0, windY + 0.12, 3.55),
    V(0, windY + 0.085, 3.86),
    V(0, deckY + 0.09, 4.18),
    V(0, deckY + 0.07, 4.48),
    V(0, deckY + 0.035, 4.63)
  ]);
  const linkGeo = new THREE.TorusGeometry(0.018, 0.0044, 5, 10);
  for (let i = 0; i < 23; i++) {
    const t = i / 22;
    const point = chainCurve.getPoint(t);
    const tangent = chainCurve.getTangent(t);
    const link = new THREE.Mesh(linkGeo, materials.ink);
    link.position.copy(point);
    link.quaternion.setFromUnitVectors(V(1, 0, 0), tangent);
    link.rotateX(i % 2 === 0 ? 0 : Math.PI / 2);
    link.castShadow = false;
    group.add(link);
  }

  // Deck hatches and fills.
  group.add(makeHatch(materials, 0.52, 0.7, 0, 2.92, materials.satinWhite, 'Anchor locker'));
  group.add(makeHatch(materials, 0.31, 0.31, 0.42, 2.14, materials.satinWhite, 'Inspection hatch'));
  group.add(makeDeckFill(materials, -0.33, 2.24, 0.048));
  group.add(makeDeckFill(materials, 0.32, 2.76, 0.036));

  // Cleats.
  group.add(placeDeckCleat(materials, -0.79, 2.58));
  group.add(placeDeckCleat(materials, 0.79, 2.58));
  group.add(placeDeckCleat(materials, -1.11, -3.59));
  group.add(placeDeckCleat(materials, 1.11, -3.59));

  // Bow navigation light, recessed into the deck tip.
  const bowLightBase = roundedBox(group, 0.08, 0.025, 0.13, 0.012, materials.polished, 0, deckY + 0.02, 4.35, 2);
  bowLightBase.rotation.x = 0.1;
  const bowLight = roundedBox(group, 0.035, 0.018, 0.065, 0.008, materials.coolLight, 0, deckY + 0.038, 4.35, 2);
  bowLight.castShadow = false;

  // Flush lifting points.
  for (const [x, z] of [[-0.45, 2.05], [0.45, 2.05], [-0.55, -3.92], [0.55, -3.92]]) {
    const s = zToS(z);
    const y = deckSurfaceY(s, x);
    const pad = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 6, 16), materials.polished);
    pad.position.set(x, y + 0.014, z);
    pad.rotation.x = Math.PI / 2;
    pad.castShadow = false;
    group.add(pad);
  }

  return group;
}

// Cabin ----------------------------------------------------------------------
const CABIN_Z0 = -2.55;
const CABIN_Z1 = 1.64;
const CABIN_LENGTH = CABIN_Z1 - CABIN_Z0;

const cabinControls = [
  { z: -2.55, w: 0.705, belt: 0.275, roof: 0.545 },
  { z: -2.30, w: 0.795, belt: 0.293, roof: 0.675 },
  { z: -1.90, w: 0.855, belt: 0.306, roof: 0.785 },
  { z: -1.35, w: 0.886, belt: 0.308, roof: 0.86 },
  { z: -0.62, w: 0.875, belt: 0.302, roof: 0.885 },
  { z: 0.12, w: 0.835, belt: 0.288, roof: 0.86 },
  { z: 0.70, w: 0.758, belt: 0.268, roof: 0.79 },
  { z: 1.08, w: 0.625, belt: 0.240, roof: 0.665 },
  { z: 1.33, w: 0.465, belt: 0.203, roof: 0.478 },
  { z: 1.52, w: 0.295, belt: 0.160, roof: 0.285 },
  { z: 1.64, w: 0.070, belt: 0.105, roof: 0.070 }
];

const cabinWB = curveFromPairs(cabinControls.map((c) => [(c.z - CABIN_Z0) / CABIN_LENGTH, c.w]), 0.2);
const cabinBeltB = curveFromPairs(cabinControls.map((c) => [(c.z - CABIN_Z0) / CABIN_LENGTH, c.belt]), 0.2);
const cabinRoofB = curveFromPairs(cabinControls.map((c) => [(c.z - CABIN_Z0) / CABIN_LENGTH, c.roof]), 0.2);

function cabinAtT(t) {
  const tt = clamp(t, 0, 1);
  const z = CABIN_Z0 + tt * CABIN_LENGTH;
  const s = zToS(z);
  const deck = deckSurfaceY(s, 0);
  const w = Math.max(0.035, sampleCurve(cabinWB, tt));
  const belt = Math.max(0.05, sampleCurve(cabinBeltB, tt));
  const roof = Math.max(0.02, sampleCurve(cabinRoofB, tt));
  return {
    t: tt,
    z,
    w,
    deck,
    bottom: deck + 0.004,
    beltY: deck + belt,
    roofY: deck + belt + roof,
    glassW: w * 0.938
  };
}

function cabinTFromZ(z) {
  return clamp((z - CABIN_Z0) / CABIN_LENGTH, 0, 1);
}

const CABIN_EXPONENT = 3.45;

function cabinRingPoint(metrics, theta, exponent = CABIN_EXPONENT, widthScale = 1, low = metrics.beltY - 0.06, high = metrics.roofY) {
  const centerY = (low + high) * 0.5;
  const halfHeight = (high - low) * 0.5;
  const x = metrics.glassW * widthScale * signedPow(Math.cos(theta), 2 / exponent);
  const y = centerY + halfHeight * signedPow(Math.sin(theta), 2 / exponent);
  return { x, y };
}

function roundedRectRadius(theta, halfWidth, halfHeight, radius) {
  const dirX = Math.cos(theta);
  const dirY = Math.sin(theta);
  let lo = 0;
  let hi = Math.hypot(halfWidth, halfHeight) + 0.001;
  for (let k = 0; k < 16; k++) {
    const mid = (lo + hi) * 0.5;
    const px = dirX * mid;
    const py = dirY * mid;
    const qx = Math.abs(px) - (halfWidth - radius);
    const qy = Math.abs(py) - (halfHeight - radius);
    const dist = Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
    if (dist < 0) lo = mid;
    else hi = mid;
  }
  return lo;
}

function buildCabinBase(materials) {
  const group = new THREE.Group();
  group.name = 'Sealed command pod';

  const N = 84;
  const R = 36;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= N; i++) {
    const m = cabinAtT(i / N);
    const low = m.bottom;
    const high = m.beltY;
    const centerY = (low + high) * 0.5;
    const halfHeight = (high - low) * 0.5;
    const corner = Math.min(0.056, m.w * 0.46, halfHeight * 0.5);
    for (let j = 0; j < R; j++) {
      const theta = (j / R) * Math.PI * 2;
      const radial = roundedRectRadius(theta, m.w, halfHeight, corner);
      positions.push(Math.cos(theta) * radial, centerY + Math.sin(theta) * radial, m.z);
    }
  }

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < R; j++) {
      const jn = (j + 1) % R;
      const a = i * R + j;
      const b = (i + 1) * R + j;
      const c = i * R + jn;
      const d = (i + 1) * R + jn;
      indices.push(a, c, b, b, c, d);
    }
  }

  // End caps.
  const rearCenter = positions.length / 3;
  const rear = cabinAtT(0);
  positions.push(0, (rear.bottom + rear.beltY) * 0.5, rear.z);
  const rearStart = 0;
  for (let j = 0; j < R; j++) indices.push(rearCenter, rearStart + ((j + 1) % R), rearStart + j);

  const frontCenter = positions.length / 3;
  const front = cabinAtT(1);
  positions.push(0, (front.bottom + front.beltY) * 0.5, front.z);
  const frontStart = N * R;
  for (let j = 0; j < R; j++) indices.push(frontCenter, frontStart + j, frontStart + ((j + 1) % R));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials.pureWhite);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  group.add(mesh);

  // Side belt trim, polished and continuous.
  for (const side of [1, -1]) {
    const points = [];
    for (let i = 0; i <= 60; i++) {
      const m = cabinAtT(i / 60);
      points.push(V(side * m.w * 0.997, m.beltY - 0.012, m.z));
    }
    tubeFromPoints(group, points, 0.0065, materials.polished, 80, 5, false, false);
  }

  // Rear service hatch, so the sealed pod reads as serviced equipment.
  const rearMetrics = cabinAtT(0.035);
  const hatch = new THREE.Group();
  hatch.position.set(0, (rearMetrics.bottom + rearMetrics.beltY) * 0.5 + 0.01, CABIN_Z0 - 0.009);
  roundedBox(hatch, 0.44, 0.15, 0.018, 0.025, materials.rubber, 0, 0, 0, 3).castShadow = false;
  roundedBox(hatch, 0.39, 0.105, 0.014, 0.018, materials.cabinDoor || materials.satinWhite, 0, 0, -0.002, 3);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.006, 6, 18, Math.PI), materials.polished);
  handle.position.set(0, -0.018, -0.012);
  handle.rotation.set(0, 0, 0);
  hatch.add(handle);
  for (const side of [-1, 1]) {
    roundedBox(hatch, 0.026, 0.018, 0.008, 0.004, materials.brushed, side * 0.19, 0.057, 0.006, 1).castShadow = false;
  }
  group.add(hatch);

  // A dark gasket at the deck joint makes the module sit on rather than melt into the deck.
  for (const side of [1, -1]) {
    const gasket = [];
    for (let i = 0; i <= 44; i++) {
      const m = cabinAtT(lerp(0.02, 0.985, i / 44));
      gasket.push(V(side * m.w * 0.999, m.deck + 0.012, m.z));
    }
    tubeFromPoints(group, gasket, 0.007, materials.rubber, 64, 4, false, false);
  }

  // Fine louvered service vents in the white beltline.
  for (const side of [1, -1]) {
    const z = -1.55;
    const tVent = cabinTFromZ(z);
    const m = cabinAtT(tVent);
    const y = m.deck + (m.beltY - m.deck) * 0.52;
    const grille = new THREE.Group();
    grille.position.set(side * (m.w + 0.003), y, z);
    roundedBox(grille, 0.016, 0.095, 0.26, 0.008, materials.ink, 0, 0, 0, 2).castShadow = false;
    for (let i = 0; i < 4; i++) {
      const slat = roundedBox(grille, 0.018, 0.009, 0.22, 0.003, materials.brushed, side * 0.004, -0.03 + i * 0.02, 0, 1);
      slat.rotation.x = 0.08;
      slat.castShadow = false;
    }
    group.add(grille);
  }

  return group;
}

function buildCanopy(materials, refs) {
  const group = new THREE.Group();
  group.name = 'Smoked glasshouse';

  const N = 92;
  const R = 24;
  const positions = [];
  const indices = [];

  for (let i = 0; i <= N; i++) {
    const m = cabinAtT(i / N);
    const low = m.beltY - 0.055;
    const high = m.roofY;
    const centerY = (low + high) * 0.5;
    const halfHeight = (high - low) * 0.5;
    for (let j = 0; j < R; j++) {
      const theta = (j / R) * Math.PI * 2;
      const x = m.glassW * signedPow(Math.cos(theta), 2 / 3.05);
      const y = centerY + halfHeight * signedPow(Math.sin(theta), 2 / 3.05);
      positions.push(x, y, m.z);
    }
  }

  for (let i = 0; i < N; i++) {
    for (let j = 0; j < R; j++) {
      const jn = (j + 1) % R;
      const a = i * R + j;
      const b = (i + 1) * R + j;
      const c = i * R + jn;
      const d = (i + 1) * R + jn;
      indices.push(a, c, b, b, c, d);
    }
  }

  const rearCenter = positions.length / 3;
  const rear = cabinAtT(0);
  positions.push(0, (rear.beltY - 0.055 + rear.roofY) * 0.5, rear.z);
  for (let j = 0; j < R; j++) indices.push(rearCenter, ((j + 1) % R), j);

  const frontCenter = positions.length / 3;
  const front = cabinAtT(1);
  positions.push(0, (front.beltY - 0.055 + front.roofY) * 0.5, front.z);
  const frontStart = N * R;
  for (let j = 0; j < R; j++) indices.push(frontCenter, frontStart + j, frontStart + ((j + 1) % R));

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const mesh = new THREE.Mesh(geometry, materials.glass);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 4;
  group.add(mesh);

  // A very dark cockpit-tub liner, so the screen reads as tinted glass rather than a window to the sea.
  const linerPositions = [];
  const linerIndices = [];
  const linerCount = 46;
  const linerRings = 20;
  for (let i = 0; i <= linerCount; i++) {
    const m = cabinAtT(i / linerCount);
    const low = m.beltY + 0.02;
    const high = m.roofY - 0.075;
    const centerY = (low + high) * 0.5;
    const halfHeight = (high - low) * 0.5;
    for (let j = 0; j < linerRings; j++) {
      const theta = (j / linerRings) * Math.PI * 2;
      const radial = 1.0;
      const x = m.glassW * 0.9 * signedPow(Math.cos(theta), 2 / 3.2) * radial;
      const y = centerY + halfHeight * signedPow(Math.sin(theta), 2 / 3.2);
      linerPositions.push(x, y, m.z);
    }
  }
  for (let i = 0; i < linerCount; i++) {
    for (let j = 0; j < linerRings; j++) {
      const jn = (j + 1) % linerRings;
      const a = i * linerRings + j;
      const b = (i + 1) * linerRings + j;
      const c = i * linerRings + jn;
      const d = (i + 1) * linerRings + jn;
      linerIndices.push(a, c, b, b, c, d);
    }
  }
  // Cap the liner so the windscreen has a solid black interior behind it.
  const linerRearCenter = linerPositions.length / 3;
  const linerRear = cabinAtT(0);
  linerPositions.push(0, (linerRear.beltY - 0.02 + linerRear.roofY) * 0.5, linerRear.z);
  for (let j = 0; j < linerRings; j++) linerIndices.push(linerRearCenter, ((j + 1) % linerRings), j);
  const linerFrontCenter = linerPositions.length / 3;
  const linerFront = cabinAtT(1);
  linerPositions.push(0, (linerFront.beltY - 0.02 + linerFront.roofY) * 0.5, linerFront.z);
  const linerFrontStart = linerCount * linerRings;
  for (let j = 0; j < linerRings; j++) linerIndices.push(linerFrontCenter, linerFrontStart + j, linerFrontStart + ((j + 1) % linerRings));
  const linerGeometry = new THREE.BufferGeometry();
  linerGeometry.setAttribute('position', new THREE.Float32BufferAttribute(linerPositions, 3));
  linerGeometry.setIndex(linerIndices);
  linerGeometry.computeVertexNormals();
  const liner = new THREE.Mesh(linerGeometry, materials.interior);
  liner.renderOrder = 2;
  group.add(liner);

  // Interior massing. It keeps the canopy reading as a deep, inhabited volume.
  const inner = new THREE.Group();
  inner.position.set(0, 0, 0);
  const interiorBox = roundedBox(inner, 1.24, 0.5, 2.25, 0.15, materials.interior, 0, 0, 0, 4);
  const cab = cabinAtT(0.48);
  interiorBox.position.set(0, cab.beltY + 0.20, -0.46);
  interiorBox.rotation.x = -0.025;
  const dash = roundedBox(inner, 1.08, 0.27, 0.56, 0.09, materials.interiorPanel, 0, cab.beltY + 0.4, 0.37, 3);
  dash.rotation.x = 0.18;

  // A mission display, just visible through the tinted glazing.
  const display = new THREE.Mesh(new THREE.PlaneGeometry(0.48, 0.3), materials.screen);
  display.position.set(0, cab.beltY + 0.51, 0.27);
  display.rotation.x = -0.55;
  inner.add(display);

  // Equipment rack LEDs.
  const ledGeo = new THREE.SphereGeometry(0.009, 6, 4);
  for (let i = 0; i < 8; i++) {
    const led = new THREE.Mesh(ledGeo, i % 3 === 0 ? materials.amberLight : materials.tealGlow);
    led.position.set(-0.46 + (i % 4) * 0.12, cab.beltY + 0.26 + Math.floor(i / 4) * 0.08, 0.17);
    inner.add(led);
  }
  const innerGlow = new THREE.PointLight(0x83e9d0, 0.62, 2.5, 2);
  innerGlow.position.set(0, cab.beltY + 0.48, -0.35);
  inner.add(innerGlow);
  group.add(inner);

  // B-pillars, laid over the glass.
  for (const side of [1, -1]) {
    for (const t of [0.20, 0.70]) {
      const m = cabinAtT(t);
      const sideArc = [];
      for (let k = 0; k <= 7; k++) {
        const theta = lerp(-Math.PI * 0.12, Math.PI / 2, k / 7);
        const p = cabinRingPoint(m, theta);
        sideArc.push(V(side * (p.x + 0.012), p.y, m.z));
      }
      tubeFromPoints(group, sideArc, 0.0072, materials.darkMetal, 18, 4, false, false);
    }

    // A slim white A-pillar catches the silhouette where the hardtop meets the windscreen.
    const tA = 0.868;
    const mA = cabinAtT(tA);
    const aPillar = [];
    for (let k = 0; k <= 8; k++) {
      const theta = lerp(-Math.PI * 0.16, Math.PI / 2, k / 8);
      const p = cabinRingPoint(mA, theta);
      aPillar.push(V(side * (p.x + 0.014), p.y, mA.z));
    }
    tubeFromPoints(group, aPillar, 0.0105, materials.pureWhite, 20, 5, false, false);
  }

  // A narrow warm LED line under the glasshouse.
  for (const side of [1, -1]) {
    const points = [];
    for (let i = 0; i <= 38; i++) {
      const m = cabinAtT(lerp(0.13, 0.78, i / 38));
      points.push(V(side * (m.w * 0.955), m.beltY - 0.055, m.z));
    }
    tubeFromPoints(group, points, 0.0045, materials.warmLight, 42, 4, false, false);
  }

  return group;
}

function roofTopY(t, xFraction = 0) {
  const m = cabinAtT(t);
  const low = m.beltY - 0.055;
  const high = m.roofY;
  const centerY = (low + high) * 0.5;
  const halfHeight = (high - low) * 0.5;
  const frac = clamp(Math.abs(xFraction), 0, 0.995);
  return centerY + halfHeight * Math.pow(1 - Math.pow(frac, 3.05), 1 / 3.05);
}

function buildRoof(materials) {
  const group = new THREE.Group();
  group.name = 'White roof blade';

  const N = 64;
  const K = 12;
  const positions = [];
  const indices = [];
  const uvs = [];
  const widthFraction = 0.705;
  const roofT0 = 0.036;
  const roofT1 = 0.892;

  for (let i = 0; i <= N; i++) {
    const t = lerp(roofT0, roofT1, i / N);
    const m = cabinAtT(t);
    for (let j = 0; j <= K; j++) {
      const xf = lerp(-widthFraction, widthFraction, j / K);
      const x = xf * m.glassW;
      const y = roofTopY(t, xf) + 0.008;
      positions.push(x, y, m.z);
      uvs.push(j / K, i / N);
    }
  }
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < K; j++) {
      const a = i * (K + 1) + j;
      const b = (i + 1) * (K + 1) + j;
      const c = i * (K + 1) + j + 1;
      const d = (i + 1) * (K + 1) + j + 1;
      indices.push(a, b, c, b, d, c);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const roof = new THREE.Mesh(geometry, materials.pureWhite);
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);

  // Hardtop edge with real thickness, then a deep gasket line around the glazing joint.
  const roofEdge = [];
  const roofLower = [];
  for (let i = 0; i <= 60; i++) {
    const t = lerp(roofT0, roofT1, i / 60);
    const m = cabinAtT(t);
    const x = -widthFraction * m.glassW;
    const y = roofTopY(t, -widthFraction) + 0.008;
    roofEdge.push(V(x, y, m.z));
    roofLower.push(V(x, y - 0.025, m.z));
  }
  for (let i = 60; i >= 0; i--) {
    const t = lerp(roofT0, roofT1, i / 60);
    const m = cabinAtT(t);
    const x = widthFraction * m.glassW;
    const y = roofTopY(t, widthFraction) + 0.008;
    roofEdge.push(V(x, y, m.z));
    roofLower.push(V(x, y - 0.025, m.z));
  }
  const fasciaPositions = [];
  const fasciaIndices = [];
  for (let i = 0; i < roofEdge.length; i++) {
    fasciaPositions.push(roofEdge[i].x, roofEdge[i].y, roofEdge[i].z);
    fasciaPositions.push(roofLower[i].x, roofLower[i].y, roofLower[i].z);
  }
  for (let i = 0; i < roofEdge.length; i++) {
    const next = (i + 1) % roofEdge.length;
    const a = i * 2;
    const b = next * 2;
    const c = i * 2 + 1;
    const d = next * 2 + 1;
    fasciaIndices.push(a, b, c, b, d, c);
  }
  const fasciaGeometry = new THREE.BufferGeometry();
  fasciaGeometry.setAttribute('position', new THREE.Float32BufferAttribute(fasciaPositions, 3));
  fasciaGeometry.setIndex(fasciaIndices);
  fasciaGeometry.computeVertexNormals();
  const fasciaMaterial = materials.pureWhite.clone();
  fasciaMaterial.side = THREE.DoubleSide;
  const fascia = new THREE.Mesh(fasciaGeometry, fasciaMaterial);
  fascia.castShadow = true;
  fascia.receiveShadow = true;
  group.add(fascia);
  tubeFromPoints(group, roofLower, 0.0058, materials.carbon, 130, 5, true, false);

  // Aft solar array, following the crown of the roof.
  const solarPositions = [];
  const solarIndices = [];
  const solarUvs = [];
  const solarN = 25;
  const solarK = 8;
  const sT0 = 0.075;
  const sT1 = 0.272;
  const solarFrac = 0.70;
  for (let i = 0; i <= solarN; i++) {
    const t = lerp(sT0, sT1, i / solarN);
    const m = cabinAtT(t);
    for (let j = 0; j <= solarK; j++) {
      const xf = lerp(-solarFrac, solarFrac, j / solarK);
      solarPositions.push(xf * m.glassW, roofTopY(t, xf) + 0.022, m.z);
      solarUvs.push(j / solarK, i / solarN);
    }
  }
  for (let i = 0; i < solarN; i++) {
    for (let j = 0; j < solarK; j++) {
      const a = i * (solarK + 1) + j;
      const b = (i + 1) * (solarK + 1) + j;
      const c = i * (solarK + 1) + j + 1;
      const d = (i + 1) * (solarK + 1) + j + 1;
      solarIndices.push(a, b, c, b, d, c);
    }
  }
  const solarGeometry = new THREE.BufferGeometry();
  solarGeometry.setAttribute('position', new THREE.Float32BufferAttribute(solarPositions, 3));
  solarGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(solarUvs, 2));
  solarGeometry.setIndex(solarIndices);
  solarGeometry.computeVertexNormals();
  const solar = new THREE.Mesh(solarGeometry, materials.solar);
  solar.castShadow = true;
  solar.receiveShadow = true;
  group.add(solar);

  // Frame around the array.
  for (const side of [-1, 1]) {
    const edge = [];
    for (let i = 0; i <= 15; i++) {
      const t = lerp(sT0, sT1, i / 15);
      const m = cabinAtT(t);
      edge.push(V(side * solarFrac * m.glassW, roofTopY(t, side * solarFrac) + 0.025, m.z));
    }
    tubeFromPoints(group, edge, 0.0065, materials.brushed, 22, 4, false, false);
  }
  for (const t of [sT0, sT1]) {
    const edge = [];
    const m = cabinAtT(t);
    for (let j = 0; j <= 12; j++) {
      const xf = lerp(-solarFrac, solarFrac, j / 12);
      edge.push(V(xf * m.glassW, roofTopY(t, xf) + 0.025, m.z));
    }
    tubeFromPoints(group, edge, 0.0065, materials.brushed, 18, 4, false, false);
  }

  // A hairline orange signature at the forward edge of the roof.
  const accent = [];
  for (let j = 0; j <= 10; j++) {
    const xf = lerp(-0.42, 0.42, j / 10);
    accent.push(V(xf * cabinAtT(0.872).glassW, roofTopY(0.872, xf) + 0.015, cabinAtT(0.872).z));
  }
  tubeFromPoints(group, accent, 0.0045, materials.ember, 18, 4, false, false);

  return group;
}



// Sensor mast ----------------------------------------------------------------
function buildMast(materials, refs) {
  const group = new THREE.Group();
  group.name = 'Sensor mast';
  const tMast = cabinTFromZ(-0.46);
  const m = cabinAtT(tMast);
  const baseY = roofTopY(tMast, 0) + 0.012;
  group.position.set(0, baseY, m.z);

  // Gasketed carbon plinth.
  roundedBox(group, 0.42, 0.028, 0.52, 0.012, materials.rubber, 0, 0.009, 0, 2).castShadow = false;
  roundedBox(group, 0.36, 0.055, 0.44, 0.08, materials.carbon, 0, 0.044, 0, 3);
  roundedBox(group, 0.24, 0.04, 0.29, 0.07, materials.darkMetal, 0, 0.085, 0, 2);

  const mast = new THREE.Group();
  mast.position.y = 0.09;
  mast.rotation.x = -0.075;
  group.add(mast);

  // Tapered, foil-sectioned carbon spar.
  const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.085, 0.77, 24, 3), materials.carbon);
  spar.position.y = 0.385;
  spar.scale.z = 1.75;
  spar.castShadow = true;
  spar.receiveShadow = true;
  mast.add(spar);

  const leading = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.015, 0.75, 8), materials.polished);
  leading.position.set(0, 0.39, 0.056);
  leading.castShadow = false;
  mast.add(leading);

  // Crossbar with turned-up wing tips.
  const crossbarY = 0.795;
  const crossbar = roundedBox(mast, 1.06, 0.035, 0.13, 0.014, materials.carbon, 0, crossbarY, 0, 3);
  for (const side of [-1, 1]) {
    const tip = roundedBox(mast, 0.12, 0.025, 0.11, 0.012, materials.carbon, side * 0.57, crossbarY + 0.013, -0.012, 2);
    tip.rotation.z = side * 0.18;
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), materials.polished);
    cap.position.set(side * 0.62, crossbarY + 0.024, -0.015);
    mast.add(cap);
  }

  // Radome.
  const radomeY = crossbarY + 0.08;
  const radomeBase = new THREE.Mesh(new THREE.CylinderGeometry(0.205, 0.225, 0.05, 32), materials.darkMetal);
  radomeBase.position.set(0, radomeY, 0);
  radomeBase.castShadow = true;
  mast.add(radomeBase);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.205, 0.007, 8, 36), materials.polished);
  ring.rotation.x = Math.PI / 2;
  ring.position.set(0, radomeY + 0.025, 0);
  mast.add(ring);
  const radomeProfile = [
    [0.006, 0.0],
    [0.19, 0.008],
    [0.245, 0.035],
    [0.252, 0.065],
    [0.238, 0.105],
    [0.205, 0.152],
    [0.145, 0.195],
    [0.07, 0.218],
    [0.0, 0.225]
  ];
  makeLathe(mast, radomeProfile, 48, materials.pureWhite, V(0, radomeY + 0.025, 0), true);
  const radomeTrim = new THREE.Mesh(new THREE.CylinderGeometry(0.223, 0.239, 0.008, 40), materials.brushed);
  radomeTrim.position.set(0, radomeY + 0.032, 0);
  mast.add(radomeTrim);

  // A small spinning LiDAR puck, forward of the radome.
  const lidarMount = new THREE.Group();
  lidarMount.position.set(0, radomeY + 0.02, 0.27);
  const mountPost = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.03, 0.16, 10), materials.darkMetal);
  mountPost.position.y = 0.08;
  lidarMount.add(mountPost);
  const lidarBody = new THREE.Mesh(new THREE.CylinderGeometry(0.074, 0.083, 0.075, 24), materials.ink);
  lidarBody.position.y = 0.188;
  lidarBody.castShadow = true;
  lidarMount.add(lidarBody);
  const lidarRing = new THREE.Mesh(new THREE.TorusGeometry(0.077, 0.004, 6, 32), materials.tealGlow);
  lidarRing.rotation.x = Math.PI / 2;
  lidarRing.position.y = 0.224;
  lidarMount.add(lidarRing);
  const lidarRotor = new THREE.Group();
  lidarRotor.position.y = 0.23;
  const rotor = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.022, 20), materials.darkMetal);
  rotor.castShadow = true;
  lidarRotor.add(rotor);
  const rotorIndex = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.028, 0.012), materials.tealGlow);
  rotorIndex.position.set(0.028, 0.002, 0);
  lidarRotor.add(rotorIndex);
  lidarMount.add(lidarRotor);
  refs.lidarRotor = lidarRotor;
  mast.add(lidarMount);

  // GPS domes on the crossbar.
  for (const side of [-1, 1]) {
    const gps = new THREE.Group();
    gps.position.set(side * 0.365, crossbarY + 0.022, -0.015);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.06, 16), materials.darkMetal);
    stem.position.y = 0.035;
    gps.add(stem);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.073, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), materials.pureWhite);
    dome.position.y = 0.063;
    dome.castShadow = true;
    gps.add(dome);
    const baseRing = new THREE.Mesh(new THREE.TorusGeometry(0.063, 0.006, 6, 20), materials.brushed);
    baseRing.rotation.x = Math.PI / 2;
    baseRing.position.y = 0.064;
    gps.add(baseRing);
    mast.add(gps);
  }

  // Two slim antennas, angled outboard and aft.
  for (const side of [-1, 1]) {
    const base = new THREE.Group();
    base.position.set(side * 0.505, crossbarY + 0.022, -0.02);
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.024, 0.075, 12), materials.darkMetal);
    mount.position.y = 0.038;
    mount.castShadow = true;
    base.add(mount);
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 12), materials.ink);
    coil.position.y = 0.1;
    coil.castShadow = true;
    base.add(coil);
    const whipPoints = [
      V(0, 0.1, 0),
      V(side * 0.022, 0.32, -0.028),
      V(side * 0.048, 0.54, -0.07)
    ];
    tubeFromPoints(base, whipPoints, 0.0042, materials.ink, 16, 4, false, true);
    mast.add(base);
  }

  // Masthead light on the trailing edge.
  const mastheadMount = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.1, 8), materials.polished);
  mastheadMount.position.set(0, crossbarY + 0.2, -0.11);
  mastheadMount.rotation.x = -0.2;
  mast.add(mastheadMount);
  const masthead = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), materials.coolLight);
  masthead.position.set(0, crossbarY + 0.255, -0.12);
  mast.add(masthead);

  // Cable loom down the back of the spar.
  const loom = [];
  for (let i = 0; i <= 12; i++) {
    const y = lerp(0.08, 0.7, i / 12);
    loom.push(V(0.0, y, -0.075 - Math.sin(i / 12 * Math.PI) * 0.02));
  }
  tubeFromPoints(mast, loom, 0.008, materials.rubber, 22, 5, false, false);

  group.add(mast);
  refs.mast = group;
  return group;
}

function buildRoofAccessories(materials, refs) {
  const group = new THREE.Group();
  group.name = 'Roof sensors and searchlight';

  // Forward 360 camera pod.
  const camT = cabinTFromZ(0.88);
  const camBase = roofTopY(camT, 0) + 0.008;
  const cameraGroup = new THREE.Group();
  cameraGroup.position.set(0, camBase, 0.88);
  roundedBox(cameraGroup, 0.16, 0.022, 0.16, 0.01, materials.rubber, 0, 0.005, 0, 2).castShadow = false;
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.037, 0.055, 0.11, 16), materials.carbon);
  stem.position.y = 0.07;
  stem.castShadow = true;
  cameraGroup.add(stem);
  const yoke = new THREE.Group();
  yoke.position.y = 0.17;
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.1, 0.04), materials.darkMetal);
    arm.position.set(side * 0.075, 0.0, 0);
    yoke.add(arm);
  }
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.092, 24, 16), materials.glass);
  ball.position.y = -0.03;
  ball.renderOrder = 4;
  yoke.add(ball);
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 0.025, 24), materials.ink);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, -0.03, 0.096);
  yoke.add(lens);
  const lensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.039, 24), materials.glassLight);
  lensGlass.position.set(0, -0.03, 0.111);
  lensGlass.renderOrder = 5;
  yoke.add(lensGlass);
  const lensRing = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.006, 6, 24), materials.polished);
  lensRing.position.set(0, -0.03, 0.11);
  yoke.add(lensRing);
  const cameraLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), materials.tealGlow);
  cameraLed.position.set(0.035, 0.04, 0.06);
  yoke.add(cameraLed);
  cameraGroup.add(yoke);
  group.add(cameraGroup);
  refs.cameraPod = yoke;

  // Searchlight.
  const lightT = cabinTFromZ(0.62);
  const lightY = roofTopY(lightT, 0.22) + 0.005;
  const search = new THREE.Group();
  search.position.set(0.36, lightY, 0.62);
  addMesh(search, new THREE.CylinderGeometry(0.05, 0.06, 0.035, 18), materials.brushed, { position: V(0, 0.02, 0) });
  const lampBody = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.057, 0.16, 18), materials.darkMetal);
  lampBody.rotation.x = Math.PI / 2 - 0.12;
  lampBody.position.set(0, 0.09, 0.04);
  lampBody.castShadow = true;
  search.add(lampBody);
  const lampLens = new THREE.Mesh(new THREE.CircleGeometry(0.043, 20), materials.warmLight);
  lampLens.position.set(0, 0.096, 0.125);
  lampLens.rotation.x = -0.12;
  search.add(lampLens);
  const lampRing = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.006, 6, 20), materials.brushed);
  lampRing.position.set(0, 0.096, 0.126);
  lampRing.rotation.x = -0.12;
  search.add(lampRing);
  group.add(search);
  refs.searchlight = search;

  // A compact chrome horn on the port side.
  const hornT = cabinTFromZ(0.65);
  const hornY = roofTopY(hornT, -0.24) + 0.008;
  const horn = new THREE.Group();
  horn.position.set(-0.38, hornY, 0.65);
  addMesh(horn, new THREE.CylinderGeometry(0.024, 0.028, 0.025, 14), materials.polished, { position: V(0, 0.012, 0) });
  const trumpet = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.052, 0.21, 18), materials.polished);
  trumpet.rotation.x = Math.PI / 2 - 0.08;
  trumpet.position.set(0, 0.06, 0.1);
  trumpet.castShadow = true;
  horn.add(trumpet);
  const hornMouth = new THREE.Mesh(new THREE.CircleGeometry(0.054, 18), materials.darkMetal);
  hornMouth.position.set(0, 0.068, 0.205);
  hornMouth.rotation.x = -0.08;
  horn.add(hornMouth);
  group.add(horn);

  // GPS mushroom at the rear of the roof.
  for (const [x, z] of [[-0.46, -1.02], [0.46, -1.02]]) {
    const t = cabinTFromZ(z);
    const y = roofTopY(t, x / cabinAtT(t).glassW) + 0.008;
    const gps = new THREE.Group();
    gps.position.set(x, y, z);
    addMesh(gps, new THREE.CylinderGeometry(0.025, 0.035, 0.045, 12), materials.darkMetal, { position: V(0, 0.022, 0) });
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.048, 16, 9, 0, Math.PI * 2, 0, Math.PI / 2), materials.pureWhite);
    dome.position.y = 0.046;
    dome.castShadow = true;
    gps.add(dome);
    group.add(gps);
  }

  // Navigation lights at the leading edge of the white pod.
  for (const side of [1, -1]) {
    const t = 0.785;
    const m = cabinAtT(t);
    const nav = new THREE.Group();
    nav.position.set(side * m.w * 0.9, m.beltY + 0.015, m.z);
    nav.rotation.y = side === 1 ? 0 : Math.PI;
    const base = roundedBox(nav, 0.055, 0.04, 0.12, 0.012, materials.polished, 0, 0, 0, 2);
    base.rotation.z = side * -0.1;
    const lens = roundedBox(nav, 0.035, 0.022, 0.075, 0.008, side === 1 ? materials.navGreen : materials.navRed, 0.008, 0.008, 0, 2);
    lens.castShadow = false;
    group.add(nav);
  }

  // Under-deck courtesy lights.
  for (const side of [1, -1]) {
    for (const z of [0.35, -0.35, -1.05]) {
      const t = cabinTFromZ(z);
      const m = cabinAtT(t);
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.011, 8, 6), materials.warmLight);
      lamp.position.set(side * m.w * 1.005, m.beltY - 0.28, z);
      lamp.scale.set(0.5, 1, 1);
      group.add(lamp);
    }
  }

  // Aft-facing high-level brake / stern light on the pod.
  const sternLight = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), materials.coolLight);
  sternLight.position.set(0, cabinAtT(0).beltY + 0.16, CABIN_Z0 - 0.02);
  group.add(sternLight);

  return group;
}

// Aft deck ------------------------------------------------------------------
function buildAftDeck(materials, refs) {
  const group = new THREE.Group();
  group.name = 'Aft mission deck';

  group.add(makeHatch(materials, 0.62, 0.68, 0, -3.08, materials.satinWhite, 'Mission bay hatch'));
  group.add(makeDeckFill(materials, -0.74, -2.78, 0.038));
  group.add(makeDeckFill(materials, 0.74, -2.78, 0.038));

  // Carbon equipment case with orange latches.
  const caseGroup = new THREE.Group();
  const caseZ = -3.47;
  const caseS = zToS(caseZ);
  const caseY = deckSurfaceY(caseS, -0.57) + 0.012;
  caseGroup.position.set(-0.57, caseY, caseZ);
  caseGroup.rotation.x = -Math.atan((deckSurfaceY(zToS(caseZ + 0.05), -0.57) - deckSurfaceY(zToS(caseZ - 0.05), -0.57)) / 0.1);
  roundedBox(caseGroup, 0.45, 0.2, 0.58, 0.05, materials.carbon, 0, 0.1, 0, 4);
  roundedBox(caseGroup, 0.4, 0.025, 0.52, 0.012, materials.rubber, 0, 0.207, 0, 2).castShadow = false;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.009, 6, 16, Math.PI), materials.polished);
  handle.position.set(0, 0.22, -0.12);
  handle.rotation.x = -Math.PI / 2;
  caseGroup.add(handle);
  for (const side of [-1, 1]) {
    roundedBox(caseGroup, 0.035, 0.035, 0.14, 0.012, materials.ember, side * 0.2, 0.15, 0, 2).castShadow = false;
  }
  const caseLed = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 4), materials.tealGlow);
  caseLed.position.set(0.12, 0.16, 0.295);
  caseGroup.add(caseLed);
  group.add(caseGroup);

  // Compact recovery winch, tucked against the starboard coaming.
  const winch = new THREE.Group();
  const winchZ = -3.72;
  const winchS = zToS(winchZ);
  const winchY = deckSurfaceY(winchS, 0.62) + 0.012;
  winch.position.set(0.62, winchY, winchZ);
  for (const side of [-1, 1]) {
    const frame = [];
    frame.push(V(side * 0.13, 0.015, -0.1), V(side * 0.13, 0.17, -0.055), V(side * 0.13, 0.2, 0));
    tubeFromPoints(winch, frame, 0.012, materials.polished, 18, 5, false, true);
  }
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.3, 20), materials.darkMetal);
  drum.rotation.z = Math.PI / 2;
  drum.position.set(0, 0.2, 0);
  drum.castShadow = true;
  winch.add(drum);
  const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.078, 0.26, 20), materials.emberMatte);
  rope.rotation.z = Math.PI / 2;
  rope.position.set(0, 0.2, 0);
  winch.add(rope);
  const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.42, 10), materials.brushed);
  axle.rotation.z = Math.PI / 2;
  axle.position.set(0, 0.2, 0);
  winch.add(axle);
  roundedBox(winch, 0.24, 0.032, 0.2, 0.01, materials.carbon, 0, 0.025, 0, 2);
  group.add(winch);

  // Flush tie-down rail with small orange soft shackles.
  for (let i = 0; i < 3; i++) {
    const z = -2.7 - i * 0.36;
    const s = zToS(z);
    const y = deckSurfaceY(s, 0.18);
    roundedBox(group, 0.055, 0.012, 0.18, 0.004, materials.darkMetal, 0.18, y + 0.011, z, 1).castShadow = false;
    const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.007, 6, 14), materials.ember);
    shackle.rotation.x = Math.PI / 2;
    shackle.position.set(0.18, y + 0.03, z);
    group.add(shackle);
  }

  // Aft side rails and life ring.
  for (const side of [1, -1]) {
    const points = [];
    for (let i = 0; i <= 30; i++) {
      const s = lerp(0.055, 0.225, i / 30);
      const station = stationAt(s);
      const half = station.width * sampleCurve(sectionCurve, 1);
      const x = side * Math.max(0.04, half - 0.085);
      const y = deckSurfaceY(s, x) + 0.46;
      points.push(V(x, y, station.z));
    }
    tubeFromPoints(group, points, 0.0075, materials.polished, 40, 5, false, true);
    for (const s of [0.06, 0.21]) {
      const station = stationAt(s);
      const half = station.width * sampleCurve(sectionCurve, 1);
      const x = side * Math.max(0.04, half - 0.085);
      const y = deckSurfaceY(s, x);
      addMesh(group, new THREE.CylinderGeometry(0.0105, 0.0125, 0.46, 10), materials.polished, { position: V(x, y + 0.23, station.z) });
    }
  }

  // Life ring, mounted vertically on the port rail.
  const ringS = 0.13;
  const ringStation = stationAt(ringS);
  const ringHalf = ringStation.width * sampleCurve(sectionCurve, 1);
  const ringX = -(ringHalf - 0.04);
  const ringY = deckSurfaceY(ringS, ringX) + 0.25;
  const lifeRing = new THREE.Group();
  lifeRing.position.set(ringX, ringY, ringStation.z - 0.15);
  lifeRing.rotation.y = Math.PI / 2;
  const lifeTorus = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.048, 12, 32), materials.ember);
  lifeTorus.castShadow = true;
  lifeRing.add(lifeTorus);
  for (let i = 0; i < 4; i++) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.05, 8, 10, Math.PI * 0.18), materials.pureWhite);
    band.rotation.z = i * Math.PI / 2;
    lifeRing.add(band);
  }
  const ropeArc = [];
  for (let i = 0; i <= 16; i++) {
    const angle = lerp(-0.55, 0.55, i / 16);
    ropeArc.push(V(Math.sin(angle) * 0.28, -0.27 + Math.cos(angle) * 0.035, 0));
  }
  tubeFromPoints(lifeRing, ropeArc, 0.006, materials.satinWhite, 20, 4, false, false);
  for (const side of [-1, 1]) {
    const strap = new THREE.Mesh(new THREE.TorusGeometry(0.105, 0.012, 6, 16, Math.PI), materials.ink);
    strap.rotation.y = Math.PI / 2;
    strap.rotation.z = side * 0.1;
    strap.position.set(-0.02, side * 0.16, 0);
    lifeRing.add(strap);
  }
  group.add(lifeRing);
  refs.lifeRing = lifeRing;

  // Towing eye at the transom.
  const towEye = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 10, 22, Math.PI * 1.3), materials.polished);
  towEye.position.set(0, 0.48, Z_STERN - 0.02);
  towEye.rotation.set(0, Math.PI / 2, Math.PI * 0.18);
  group.add(towEye);
  addMesh(group, new THREE.CylinderGeometry(0.11, 0.12, 0.025, 20), materials.brushed, { position: V(0, 0.42, Z_STERN + 0.008) }).rotation.x = Math.PI / 2;

  // Teak swim platform on polished brackets.
  const platform = new THREE.Group();
  platform.name = 'Swim platform';
  platform.position.set(0, 0.115, Z_STERN - 0.4);
  const platformDeck = roundedBox(platform, 1.52, 0.045, 0.37, 0.035, materials.teak, 0, 0, 0, 3);
  platformDeck.rotation.x = 0.012;
  for (const side of [-1, 1]) {
    const bracketPoints = [
      V(side * 0.56, 0.02, 0.1),
      V(side * 0.6, -0.02, -0.1),
      V(side * 0.66, 0.22, -0.18)
    ];
    tubeFromPoints(platform, bracketPoints, 0.014, materials.polished, 16, 5, false, true);
    const hinge = roundedBox(platform, 0.05, 0.035, 0.07, 0.012, materials.brushed, side * 0.55, 0.03, 0.12, 2);
    hinge.castShadow = false;
  }
  const ladder = new THREE.Group();
  ladder.position.set(0.32, 0.02, -0.3);
  for (const side of [-1, 1]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.24, 0.36), materials.titanium);
    strip.position.set(side * 0.065, 0.12, 0);
    strip.rotation.x = -1.25;
    ladder.add(strip);
  }
  for (let i = 0; i < 2; i++) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.13, 8), materials.polished);
    rung.rotation.z = Math.PI / 2;
    rung.position.set(0, 0.085 + i * 0.09, -0.08 + i * 0.055);
    ladder.add(rung);
  }
  platform.add(ladder);
  group.add(platform);

  // Stern flag staff and pennant.
  const staffBaseY = stationAt(0.032).sheer;
  const flagStaff = new THREE.Group();
  flagStaff.position.set(0, staffBaseY + 0.02, -4.37);
  const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.015, 0.9, 10), materials.carbon);
  staff.position.y = 0.45;
  staff.castShadow = true;
  flagStaff.add(staff);
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8), materials.polished);
  finial.position.y = 0.905;
  flagStaff.add(finial);
  addMesh(flagStaff, new THREE.CylinderGeometry(0.038, 0.045, 0.02, 16), materials.brushed, { position: V(0, 0.01, 0) });

  const flagCols = 14;
  const flagRows = 3;
  const flagPositions = [];
  const flagIndices = [];
  for (let i = 0; i <= flagCols; i++) {
    const x = (i / flagCols) * 0.56;
    const halfHeight = 0.085 * (1 - Math.pow(i / flagCols, 1.3) * 0.86) + 0.002;
    for (let j = 0; j <= flagRows; j++) {
      flagPositions.push(x, lerp(-halfHeight, halfHeight, j / flagRows), 0);
    }
  }
  for (let i = 0; i < flagCols; i++) {
    for (let j = 0; j < flagRows; j++) {
      const a = i * (flagRows + 1) + j;
      const b = (i + 1) * (flagRows + 1) + j;
      const c = i * (flagRows + 1) + j + 1;
      const d = (i + 1) * (flagRows + 1) + j + 1;
      flagIndices.push(a, b, c, b, d, c);
    }
  }
  const flagGeometry = new THREE.BufferGeometry();
  flagGeometry.setAttribute('position', new THREE.Float32BufferAttribute(flagPositions, 3));
  flagGeometry.setIndex(flagIndices);
  flagGeometry.computeVertexNormals();
  const flagMaterial = new THREE.MeshStandardMaterial({
    color: 0xd95f3f,
    roughness: 0.72,
    metalness: 0.0,
    side: THREE.DoubleSide
  });
  const flag = new THREE.Mesh(flagGeometry, flagMaterial);
  flag.position.set(0, 0.865, 0);
  flag.rotation.y = Math.PI / 2;
  flag.castShadow = true;
  flagStaff.add(flag);
  refs.flag = flag;
  refs.flagBasePositions = flagGeometry.attributes.position.array.slice();
  group.add(flagStaff);

  return group;
}

function buildHullDecal(materials, side) {
  const group = new THREE.Group();
  const cols = 34;
  const rows = 7;
  const s0 = 0.735;
  const s1 = 0.885;
  const y0 = 0.34;
  const y1 = 0.64;
  const positions = [];
  const uvs = [];
  const indices = [];

  for (let i = 0; i <= cols; i++) {
    const s = lerp(s0, s1, i / cols);
    for (let j = 0; j <= rows; j++) {
      const y = lerp(y0, y1, j / rows);
      const p = hullPointAtY(s, y, side, 0.012);
      positions.push(p.x, p.y + 0.004, p.z);
      const u = side === 1 ? 1 - i / cols : i / cols;
      uvs.push(u, j / rows);
    }
  }
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      const a = i * (rows + 1) + j;
      const b = (i + 1) * (rows + 1) + j;
      const c = i * (rows + 1) + j + 1;
      const d = (i + 1) * (rows + 1) + j + 1;
      if (side === 1) indices.push(a, c, b, b, c, d);
      else indices.push(a, b, c, b, d, c);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, materials.hullDecal);
  mesh.renderOrder = 3;
  mesh.castShadow = false;
  group.add(mesh);
  return group;
}



// Assembly -------------------------------------------------------------------
export function createBoat({ renderer, materials }) {
  const root = new THREE.Group();
  root.name = 'PELAGIC CORMORANT C-7';

  const vessel = new THREE.Group();
  vessel.name = 'Vessel';
  root.add(vessel);

  const refs = {};

  const hull = buildHull(materials);
  vessel.add(hull.group);
  vessel.add(buildDeck(materials));
  vessel.add(buildTransom(materials));
  vessel.add(buildWaterlineStripe(materials));
  vessel.add(buildStem(materials));
  vessel.add(buildSheerTrim(materials));
  vessel.add(buildHullStripeDetails(materials));
  vessel.add(buildHullDecal(materials, 1));
  vessel.add(buildHullDecal(materials, -1));
  vessel.add(makeDeckRail(materials));
  vessel.add(makeForedeckHardware(materials));

  const cabinBase = buildCabinBase(materials);
  vessel.add(cabinBase);
  const canopy = buildCanopy(materials, refs);
  vessel.add(canopy);
  const roof = buildRoof(materials);
  vessel.add(roof);
  const mast = buildMast(materials, refs);
  vessel.add(mast);
  const roofAccessories = buildRoofAccessories(materials, refs);
  vessel.add(roofAccessories);
  const aft = buildAftDeck(materials, refs);
  vessel.add(aft);

  // Port and starboard running lights; tiny pools of colour on the coachroof.
  const navPointPort = new THREE.PointLight(0xff2e27, 0.055, 1.8, 2);
  const navPointStarboard = new THREE.PointLight(0x4dffc0, 0.055, 1.8, 2);
  const navT = 0.785;
  const navM = cabinAtT(navT);
  navPointPort.position.set(-navM.w - 0.04, navM.beltY + 0.035, navM.z);
  navPointStarboard.position.set(navM.w + 0.04, navM.beltY + 0.035, navM.z);
  vessel.add(navPointPort, navPointStarboard);

  // Masthead glow.
  const mastLight = new THREE.PointLight(0xe9fff8, 0.22, 2.0, 2);
  mastLight.position.set(0, roofTopY(cabinTFromZ(-0.46), 0) + 1.12, -0.55);
  vessel.add(mastLight);
  refs.mastLight = mastLight;

  // Hotspot anchors. These are part of the vessel so they ride the swell with it.
  function anchorAt(position) {
    const anchor = new THREE.Object3D();
    anchor.position.set(...position);
    vessel.add(anchor);
    return anchor;
  }

  const hotspots = [
    {
      id: 'stem',
      number: '01',
      label: 'SINGLE STEM',
      kicker: '01 / HULL',
      title: 'One line into the water.',
      copy: 'A single plumb stem draws the entire hull to a four-millimetre entry. The result is a quieter bow, a drier deck, and a silhouette that reads as one continuous thought.',
      specs: [['ENTRY ANGLE', '14.6°'], ['HULL BUILD', 'CARBON / E-GLASS']],
      anchor: anchorAt([0, 1.205, 4.415]),
      focus: { theta: -0.2, phi: 1.44, radius: 7.2, target: [0, 1.0, 3.4], mobileScale: 1.0 }
    },
    {
      id: 'mast',
      number: '02',
      label: 'SENSOR MAST',
      kicker: '02 / PERCEPTION',
      title: 'The mast is the eyes.',
      copy: 'A stabilised 360° camera, solid-state LiDAR, dual GNSS and a fibre-optic inertial unit resolve Cormorant’s place in the world to two centimetres — without a hand on a wheel.',
      specs: [['SCAN RATE', '40 Hz'], ['SENSOR RANGE', '1,200 m']],
      anchor: anchorAt([0, 2.92, -0.42]),
      focus: { theta: -1.08, phi: 1.28, radius: 8.2, target: [0, 1.68, -0.34], mobileScale: 1.15 }
    },
    {
      id: 'glasshouse',
      number: '03',
      label: 'GLASSHOUSE',
      kicker: '03 / AUTONOMY',
      title: 'No one aboard. Everything considered.',
      copy: 'The sealed, climate-controlled command pod houses the autonomy core, mission compute and satellite link. Smoked glazing keeps the electronics cool and the vessel unreadable from shore.',
      specs: [['SEALING', 'IP67'], ['COMPUTE', '128 TOPS']],
      anchor: anchorAt([-0.76, 1.45, 0.25]),
      focus: { theta: -1.18, phi: 1.34, radius: 7.8, target: [0, 1.16, 0.15], mobileScale: 1.12 }
    },
    {
      id: 'drive',
      number: '04',
      label: 'JET DRIVE',
      kicker: '04 / PROPULSION',
      title: 'Purposefully quiet.',
      copy: 'Twin 60 kW electric waterjets give Cormorant a 0.63 m draft, station-keeping precision in a chop, and almost nothing behind but a wake. No props, no exposed shafts, no hurry.',
      specs: [['SPRINT', '28 KN'], ['RANGE', '420 NM']],
      anchor: anchorAt([-0.52, 0.55, -4.41]),
      focus: { theta: -2.42, phi: 1.39, radius: 6.8, target: [0, 0.62, -3.55], mobileScale: 1.12 }
    }
  ];

  // Paper over any material shuffling and make sure the small stuff reads.
  root.traverse((object) => {
    if (!object.isMesh) return;
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    if (mats.some((m) => m && m.transparent)) {
      object.castShadow = false;
    }
    if (mats.some((m) => m && (m === materials.warmLight || m === materials.tealGlow || m === materials.navRed || m === materials.navGreen || m === materials.coolLight))) {
      object.castShadow = false;
      object.receiveShadow = false;
    }
  });

  let lastTime = 0;
  const update = (time, delta) => {
    const t = time;
    // A barely perceptible swell.
    vessel.position.y = Math.sin(t * 0.52) * 0.011 + Math.sin(t * 0.91 + 0.6) * 0.003;
    vessel.rotation.x = Math.sin(t * 0.31 + 1.1) * 0.0016;
    vessel.rotation.z = Math.sin(t * 0.41 + 0.3) * 0.0026;

    if (refs.lidarRotor) {
      refs.lidarRotor.rotation.y = t * 3.8;
    }
    if (refs.cameraPod) {
      refs.cameraPod.rotation.y = Math.sin(t * 0.22) * 0.48 + Math.sin(t * 0.071) * 0.12;
      refs.cameraPod.rotation.x = Math.sin(t * 0.17 + 0.7) * 0.035;
    }
    if (refs.flag && refs.flagBasePositions) {
      const attribute = refs.flag.geometry.attributes.position;
      const base = refs.flagBasePositions;
      for (let i = 0; i < attribute.count; i++) {
        const x = base[i * 3];
        const y = base[i * 3 + 1];
        const k = clamp(x / 0.5, 0, 1);
        const ripple = Math.sin(t * 4.6 - x * 13.0) * 0.028 * k * k;
        const lift = Math.sin(t * 3.1 - x * 9.5) * 0.014 * k;
        attribute.setXYZ(i, x, y + lift, ripple);
      }
      attribute.needsUpdate = true;
      refs.flag.geometry.computeVertexNormals();
    }
    lastTime = t;
  };

  return {
    group: root,
    vessel,
    hotspots,
    update,
    refs,
    hull
  };
}
