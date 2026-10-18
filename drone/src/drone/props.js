import * as THREE from 'three';
import { bolt, ring, roundedBox, catmull } from './parts.js';

const R = 0.43; // prop tip radius
const ROOT_R = 0.043;

const CHORD_PTS = [0.032, 0.054, 0.068, 0.07, 0.063, 0.052, 0.038, 0.018, 0.0];
const SWEEP_PTS = [0.0, 0.045, 0.115, 0.205, 0.315, 0.43, 0.53, 0.6, 0.625];
const PITCH_PTS = [0.5, 0.43, 0.35, 0.27, 0.195, 0.135, 0.095, 0.07, 0.055];
const THICK_PTS = [0.0092, 0.0068, 0.0052, 0.0041, 0.0032, 0.0025, 0.0018, 0.0012, 0.0006];

// Prop cross-section, leading edge (u=+0.5) first
const CROSS = [
  [0.50, 0.0],
  [0.41, 0.5],
  [0.22, 0.86],
  [0.0, 1.0],
  [-0.24, 0.73],
  [-0.43, 0.3],
  [-0.50, 0.0],
  [-0.42, -0.18],
  [-0.2, -0.55],
  [0.1, -0.78],
  [0.36, -0.48],
];

function bladePoint(t, u, v, handedness) {
  const r = ROOT_R + t * (R - ROOT_R);
  const chord = catmull(CHORD_PTS, t);
  const sweep = catmull(SWEEP_PTS, t);
  const pitch = catmull(PITCH_PTS, t);
  const halfT = catmull(THICK_PTS, t);

  const h = handedness;
  const er = new THREE.Vector3(Math.cos(sweep), 0, h * Math.sin(sweep));
  const ec = new THREE.Vector3(Math.sin(sweep), 0, -h * Math.cos(sweep));

  const co = u * chord;
  const thickness = v * halfT + (1 - 4 * u * u) * halfT * 0.22;
  const y = co * Math.sin(pitch) + thickness * Math.cos(pitch) + t * t * 0.002 + Math.pow(t, 4) * 0.004;
  const c = co * Math.cos(pitch) - thickness * Math.sin(pitch);

  return new THREE.Vector3(
    er.x * r + ec.x * c,
    y,
    er.z * r + ec.z * c,
  );
}

function buildBladeGeometry(handedness) {
  const SEG = 42;
  const C = CROSS.length;
  const positions = [];
  const indicesMain = [];
  const indicesTip = [];

  for (let i = 0; i <= SEG; i++) {
    const t = i / SEG;
    for (const [u, v] of CROSS) {
      const p = bladePoint(t, u, v, handedness);
      positions.push(p.x, p.y, p.z);
    }
  }

  const idx = (i, j) => i * C + j;

  for (let i = 0; i < SEG; i++) {
    const target = i >= Math.round(SEG * 0.86) ? indicesTip : indicesMain;
    for (let j = 0; j < C; j++) {
      const j2 = (j + 1) % C;
      const a = idx(i, j);
      const b = idx(i, j2);
      const c = idx(i + 1, j2);
      const d = idx(i + 1, j);
      target.push(a, b, d, b, c, d);
    }
  }

  // root cap
  const rootCenter = positions.length / 3;
  positions.push(0, 0, 0);
  for (let j = 0; j < C; j++) {
    indicesMain.push(rootCenter, idx(0, (j + 1) % C), idx(0, j));
  }
  // the blade tapers to a point at t=1, so no tip cap is required

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const all = [...indicesMain, ...indicesTip];

  // ensure outward winding using signed volume
  let volume = 0;
  for (let i = 0; i < all.length; i += 3) {
    const a = all[i] * 3;
    const b = all[i + 1] * 3;
    const c = all[i + 2] * 3;
    const ax = positions[a], ay = positions[a + 1], az = positions[a + 2];
    const bx = positions[b], by = positions[b + 1], bz = positions[b + 2];
    const cx = positions[c], cy = positions[c + 1], cz = positions[c + 2];
    volume += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx);
  }
  if (volume < 0) {
    for (let i = 0; i < indicesMain.length; i += 3) {
      const t = indicesMain[i + 1];
      indicesMain[i + 1] = indicesMain[i + 2];
      indicesMain[i + 2] = t;
    }
    for (let i = 0; i < indicesTip.length; i += 3) {
      const t = indicesTip[i + 1];
      indicesTip[i + 1] = indicesTip[i + 2];
      indicesTip[i + 2] = t;
    }
  }

  geo.setIndex([...indicesMain, ...indicesTip]);
  geo.addGroup(0, indicesMain.length, 0);
  geo.addGroup(indicesMain.length, indicesTip.length, 1);
  geo.computeVertexNormals();
  return geo;
}

const bladeGeoCCW = buildBladeGeometry(1);
const bladeGeoCW = buildBladeGeometry(-1);

export function createPropAssembly(mats, tex, handedness = 1) {
  const group = new THREE.Group();
  group.name = 'prop';

  const rotor = new THREE.Group();
  group.add(rotor);

  const bladeGeo = handedness > 0 ? bladeGeoCCW : bladeGeoCW;

  const hub = roundedBox(0.088, 0.013, 0.088, 0.028, 2, mats.plastic);
  hub.position.y = 0.008;
  rotor.add(hub);

  const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(0.033, 0.038, 0.01, 28), mats.darkMetal);
  hubTop.position.y = 0.019;
  rotor.add(hubTop);

  const centre = bolt(0.0125, 0.008, mats.metal, 16);
  centre.position.y = 0.026;
  rotor.add(centre);

  const bladeHolder = new THREE.Group();
  bladeHolder.position.y = 0.014;
  rotor.add(bladeHolder);

  for (let k = 0; k < 3; k++) {
    const blade = new THREE.Mesh(bladeGeo, [mats.prop, mats.propTip]);
    blade.rotation.y = (k * Math.PI * 2) / 3;
    blade.castShadow = false;
    blade.receiveShadow = true;
    blade.userData.noShadow = true;
    bladeHolder.add(blade);
  }

  // tiny silver collar under the hub
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.041, 0.047, 0.016, 24), mats.machined);
  collar.position.y = -0.003;
  rotor.add(collar);

  // mounting bolts
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const b = bolt(0.0062, 0.005, mats.metal, 6);
    b.position.set(Math.cos(a) * 0.031, 0.015, Math.sin(a) * 0.031);
    rotor.add(b);
  }

  // motion-blur disc (only visible while spinning)
  const blurMat = new THREE.MeshBasicMaterial({
    map: tex.propBlur,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    side: THREE.DoubleSide,
  });
  const blur = new THREE.Mesh(new THREE.CircleGeometry(R, 48), blurMat);
  blur.rotation.x = -Math.PI / 2;
  blur.position.y = 0.027;
  blur.renderOrder = 4;
  blur.userData.noShadow = true;
  group.add(blur);

  return { group, rotor, blur, blurMaterial: blurMat, handedness, radius: R };
}
