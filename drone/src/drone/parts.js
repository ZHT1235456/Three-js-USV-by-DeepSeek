import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const UP = new THREE.Vector3(0, 1, 0);

/**
 * Loft a sequence of closed or open rings into a surface.
 * rings: Array<Array<THREE.Vector3>> all with the same length.
 */
export function loftGeometry(rings, {
  closed = true,
  capStart = false,
  capEnd = false,
  uvMode = 'arc',
  uvScale = 0.25,
  smooth = true,
} = {}) {
  const positions = [];
  const uvs = [];
  const indices = [];
  const ringCount = rings.length;
  const pts = rings[0].length;

  // cumulative arc lengths for the u coordinate
  const arc = (ring) => {
    const arr = [0];
    let total = 0;
    for (let i = 1; i < ring.length; i++) {
      total += ring[i].distanceTo(ring[i - 1]);
      arr.push(total);
    }
    if (closed) {
      total += ring[0].distanceTo(ring[ring.length - 1]);
      arr.push(total);
    }
    return arr;
  };

  const zAt = (ring) => ring.reduce((a, p) => a + p.z, 0) / ring.length;

  for (let r = 0; r < ringCount; r++) {
    const ring = rings[r];
    const a = arc(ring);
    for (let i = 0; i < pts; i++) {
      const p = ring[i];
      positions.push(p.x, p.y, p.z);
      if (uvMode === 'planar') {
        uvs.push(p.x / uvScale, p.z / uvScale);
      } else if (uvMode === 'planarXZ') {
        uvs.push(p.x / uvScale, p.z / uvScale);
      } else if (uvMode === 'flat') {
        uvs.push(p.x / uvScale + 0.5, p.z / uvScale + 0.5);
      } else {
        uvs.push(a[i] / uvScale, zAt(ring) / uvScale);
      }
    }
  }

  const idxOf = (r, i) => r * pts + i;

  for (let r = 0; r < ringCount - 1; r++) {
    const maxI = closed ? pts : pts - 1;
    for (let i = 0; i < maxI; i++) {
      const i2 = (i + 1) % pts;
      const a = idxOf(r, i);
      const b = idxOf(r, i2);
      const c = idxOf(r + 1, i2);
      const d = idxOf(r + 1, i);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  let capOffset = positions.length / 3;

  const addCap = (ring, flip) => {
    const normal = new THREE.Vector3();
    const start = positions.length / 3;
    const center = new THREE.Vector3();
    ring.forEach((p) => center.add(p));
    center.multiplyScalar(1 / ring.length);
    // Newell normal
    for (let i = 0; i < ring.length; i++) {
      const p = ring[i];
      const q = ring[(i + 1) % ring.length];
      normal.x += (p.y - q.y) * (p.z + q.z);
      normal.y += (p.z - q.z) * (p.x + q.x);
      normal.z += (p.x - q.x) * (p.y + q.y);
    }
    normal.normalize();
    if (flip) normal.negate();

    for (const p of ring) {
      positions.push(p.x, p.y, p.z);
      uvs.push(p.x / uvScale + 0.5, p.z / uvScale + 0.5);
    }
    positions.push(center.x, center.y, center.z);
    uvs.push(center.x / uvScale + 0.5, center.z / uvScale + 0.5);
    const cIdx = start + ring.length;

    for (let i = 0; i < ring.length; i++) {
      const a = start + i;
      const b = start + ((i + 1) % ring.length);
      if (flip) {
        indices.push(cIdx, b, a);
      } else {
        indices.push(cIdx, a, b);
      }
    }
    return normal;
  };

  // rings are expected to run front -> back and be clockwise seen from +Z,
  // so the start cap must be flipped and the end cap must not.
  if (capStart) addCap(rings[0], true);
  if (capEnd) addCap(rings[ringCount - 1], false);

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  if (smooth) geo.computeVertexNormals();
  geo.computeBoundingSphere();
  return geo;
}

/** 2D rounded-rectangle ring in local (x, y); CCW. */
export function roundedRectProfile(w, h, r, cornerSegments = 3) {
  const pts = [];
  const hw = w / 2;
  const hh = h / 2;
  const rr = Math.min(r, hw, hh);
  const corners = [
    [hw - rr, hh - rr, 0],
    [-hw + rr, hh - rr, Math.PI / 2],
    [-hw + rr, -hh + rr, Math.PI],
    [hw - rr, -hh + rr, Math.PI * 1.5],
  ];
  for (const [cx, cy, a0] of corners) {
    for (let i = 0; i <= cornerSegments; i++) {
      const a = a0 + (i / cornerSegments) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr));
    }
  }
  return pts;
}

export function cylinderBetween(a, b, radius, material, radialSegments = 14, radiusTop = radius) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(radiusTop, radius, len, radialSegments, 1, false);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function capsuleBetween(a, b, radius, material, radialSegments = 14) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = Math.max(0.001, dir.length() - radius * 2);
  const geo = new THREE.CapsuleGeometry(radius, len, 4, radialSegments);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.copy(a).add(b).multiplyScalar(0.5);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function roundedBox(w, h, d, radius = 0.01, seg = 2, material) {
  const geo = new RoundedBoxGeometry(w, h, d, seg, radius);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

export function ring(radius, tube, material, segments = 40, arc = Math.PI * 2) {
  const geo = new THREE.TorusGeometry(radius, tube, 10, segments, arc);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function bolt(radius, height, material, sides = 6) {
  const geo = new THREE.CylinderGeometry(radius, radius * 1.03, height, sides, 1);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function placeOnTop(obj, normal) {
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal.clone().normalize());
  obj.quaternion.copy(q);
  return obj;
}

export function planarUV(geo, scale = 0.12) {
  const pos = geo.attributes.position;
  const uv = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / scale;
    uv[i * 2 + 1] = pos.getZ(i) / scale;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

export function disposeObject(obj) {
  obj.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
  });
}

const _v = new THREE.Vector3();
const _q = new THREE.Quaternion();

/** Distributed bolt circle helper. */
export function boltCircle(parent, radius, count, boltRadius, height, material, y = 0, phase = 0) {
  for (let i = 0; i < count; i++) {
    const a = phase + (i / count) * Math.PI * 2;
    const m = bolt(boltRadius, height, material);
    m.position.set(Math.cos(a) * radius, y, Math.sin(a) * radius);
    parent.add(m);
  }
}

export function circlePoints(radius, count) {
  const arr = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    arr.push(new THREE.Vector3(Math.cos(a) * radius, 0, Math.sin(a) * radius));
  }
  return arr;
}

export function catmull(points, t) {
  const n = points.length - 1;
  const f = Math.min(0.999999, Math.max(0, t)) * n;
  const i = Math.floor(f);
  const u = f - i;
  const p0 = points[Math.max(0, i - 1)];
  const p1 = points[i];
  const p2 = points[Math.min(n, i + 1)];
  const p3 = points[Math.min(n, i + 2)];
  const u2 = u * u;
  const u3 = u2 * u;
  return 0.5 * (
    2 * p1 +
    (-p0 + p2) * u +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * u2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * u3
  );
}

/** Reverse triangle winding if the closed mesh is inside-out. */
export function ensureOutward(geo) {
  const pos = geo.attributes.position.array;
  const idx = geo.index.array;
  let volume = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3;
    const b = idx[i + 1] * 3;
    const c = idx[i + 2] * 3;
    volume +=
      pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1]) -
      pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c]) +
      pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (volume < 0) {
    for (let i = 0; i < idx.length; i += 3) {
      const t = idx[i + 1];
      idx[i + 1] = idx[i + 2];
      idx[i + 2] = t;
    }
    geo.index.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

export { UP };
