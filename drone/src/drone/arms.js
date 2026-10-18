import * as THREE from 'three';
import {
  loftGeometry,
  roundedRectProfile,
  roundedBox,
  bolt,
  ring,
  ensureOutward,
} from './parts.js';
import { createPropAssembly } from './props.js';
import { HULL_Y } from './body.js';

export const ROOT = { x: 0.195, z: 0.13 };
export const MOTOR = { x: 0.71, z: 0.55 };
const DX = MOTOR.x - ROOT.x;
const DZ = MOTOR.z - ROOT.z;
export const ARM_ANGLE = Math.atan2(DZ, DX);

const ARM_STATIONS = [
  { x: 0.055, w: 0.106, h: 0.068, y: 0.0 },
  { x: 0.14, w: 0.102, h: 0.064, y: 0.0015 },
  { x: 0.27, w: 0.096, h: 0.057, y: 0.0025 },
  { x: 0.4, w: 0.09, h: 0.051, y: 0.003 },
  { x: 0.52, w: 0.084, h: 0.045, y: 0.002 },
  { x: 0.595, w: 0.079, h: 0.04, y: 0.001 },
  { x: 0.622, w: 0.07, h: 0.035, y: 0.0 },
];

function armBeam(mats) {
  const profile = roundedRectProfile(1, 1, 0.22, 3); // unit-ish rounded rect
  const rings = ARM_STATIONS.map((st) => {
    return profile.map((p) => {
      return new THREE.Vector3(
        st.x,
        st.y + p.y * st.h * 0.5,
        p.x * st.w * 0.5,
      );
    });
  });
  const geo = loftGeometry(rings, {
    closed: true,
    capStart: true,
    capEnd: true,
    uvMode: 'planar',
    uvScale: 0.082,
  });
  ensureOutward(geo);
  return geo;
}

function beamTopY(x) {
  for (let i = 0; i < ARM_STATIONS.length - 1; i++) {
    const a = ARM_STATIONS[i];
    const b = ARM_STATIONS[i + 1];
    if (x >= a.x && x <= b.x) {
      const t = (x - a.x) / (b.x - a.x);
      return (a.y + a.h * 0.5) + ((b.y + b.h * 0.5) - (a.y + a.h * 0.5)) * t;
    }
  }
  return 0.02;
}

function makeGlowSprite(mats, color, scale, opacity, depthTest = true) {
  const mat = new THREE.SpriteMaterial({
    map: mats.glowRed.map,
    color,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    depthTest,
    toneMapped: false,
    opacity,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(scale);
  return s;
}

function buildMotor(mats, tex, { sx, sz, id }) {
  const motor = new THREE.Group();
  motor.name = `motor-${id}`;
  motor.position.set(0.635, 0, 0);

  // ---- mount collar / light pod
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.072, 0.021, 12), mats.gearFacet);
  collar.position.y = -0.007;
  collar.castShadow = true;
  motor.add(collar);

  const podUpper = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.063, 0.043, 12, 1), mats.gearFacet);
  podUpper.position.y = -0.03;
  podUpper.castShadow = true;
  podUpper.receiveShadow = true;
  motor.add(podUpper);

  const podLower = new THREE.Mesh(new THREE.CylinderGeometry(0.063, 0.05, 0.04, 12, 1), mats.gearFacet);
  podLower.position.y = -0.071;
  podLower.castShadow = true;
  podLower.receiveShadow = true;
  motor.add(podLower);

  const isFront = sz > 0;
  // Airframe convention: nose +Z, up +Y => port/left is +X, starboard/right is -X.
  const isRed = sx > 0;
  const ledColor = isRed ? 0xff2618 : 0x2bff72;
  const ledMat = isRed ? mats.ledRed : mats.ledGreen;
  const ledCore = isRed ? mats.ledCoreRed : mats.ledCoreGreen;

  // dark light-pipe band around the pod joint
  const band = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0675, 0.0665, 0.017, 36, 1, true),
    mats.darkMetal,
  );
  band.position.y = -0.0505;
  motor.add(band);

  const bandLens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0695, 0.0688, 0.021, 36, 1, true),
    mats.trim,
  );
  bandLens.position.y = -0.0505;
  motor.add(bandLens);

  // faint wrap-around light pipe; the bright nav window sits on the outboard arc
  const seamGlow = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0698, 0.0693, 0.0095, 36, 1, true),
    isFront ? (isRed ? mats.ledDimRed : mats.ledDimGreen) : mats.darkMetal,
  );
  seamGlow.position.y = -0.0505;
  motor.add(seamGlow);

  for (const yy of [-0.041, -0.06]) {
    const r = yy > -0.0505 ? 0.0695 : 0.0645;
    const lip = ring(r, 0.003, mats.trim, 36);
    lip.rotation.x = -Math.PI / 2;
    lip.position.y = yy;
    motor.add(lip);
  }

  const bottom = new THREE.Mesh(new THREE.CylinderGeometry(0.051, 0.043, 0.02, 12), mats.gearFacet);
  bottom.position.y = -0.099;
  bottom.castShadow = true;
  motor.add(bottom);
  const bottomCap = new THREE.Mesh(new THREE.SphereGeometry(0.043, 12, 7, 0, Math.PI * 2, 0, Math.PI / 2), mats.plasticSoft);
  bottomCap.rotation.x = Math.PI;
  bottomCap.position.y = -0.109;
  bottomCap.castShadow = true;
  motor.add(bottomCap);

  let glow = null;
  let halo = null;
  let light = null;
  if (isFront) {
    // curved outboard nav-light window: dark bezel, bright light pipe and
    // a clear protective lens cover
    const arcStart = Math.PI / 2 - 0.62;
    const arcLen = 1.24;

    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0692, 0.0692, 0.027, 24, 1, true, arcStart, arcLen),
      mats.darkMetal,
    );
    bezel.position.y = -0.0505;
    motor.add(bezel);

    const windowCore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0702, 0.0702, 0.021, 24, 1, true, arcStart + 0.08, arcLen - 0.16),
      ledCore,
    );
    windowCore.position.y = -0.0505;
    motor.add(windowCore);

    const windowCover = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0714, 0.0714, 0.029, 24, 1, true, arcStart + 0.03, arcLen - 0.06),
      mats.ledLens,
    );
    windowCover.position.y = -0.0505;
    windowCover.renderOrder = 2;
    motor.add(windowCover);

    glow = makeGlowSprite(mats, ledColor, 0.10, 0.66, true);
    glow.position.set(0.074, -0.0505, 0);
    motor.add(glow);

    halo = makeGlowSprite(mats, ledColor, 0.34, 0, true);
    halo.position.set(0.074, -0.0505, 0);
    motor.add(halo);

    light = new THREE.PointLight(ledColor, 0.05, 0.35, 2);
    light.position.set(sx * 0.03, -0.045, sz * 0.03);
    motor.add(light);
  }

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + 0.4;
    const b = bolt(0.0032, 0.003, mats.darkMetal, 8);
    b.position.set(Math.cos(a) * 0.07, -0.024, Math.sin(a) * 0.07);
    motor.add(b);
  }

  // ---- motor
  const stator = new THREE.Mesh(new THREE.CylinderGeometry(0.064, 0.066, 0.028, 32), mats.plastic);
  stator.position.y = 0.006;
  stator.castShadow = true;
  motor.add(stator);

  const copper = new THREE.Mesh(new THREE.CylinderGeometry(0.0645, 0.0645, 0.007, 32), mats.copper);
  copper.position.y = 0.023;
  motor.add(copper);

  const bell = new THREE.Mesh(new THREE.CylinderGeometry(0.0735, 0.0745, 0.079, 40), mats.plastic);
  bell.position.y = 0.066;
  bell.castShadow = true;
  bell.receiveShadow = true;
  motor.add(bell);

  // subtle machined grooves
  for (const y of [0.035, 0.047]) {
    const groove = ring(0.0742, 0.0014, mats.trim, 40);
    groove.rotation.x = -Math.PI / 2;
    groove.position.y = y;
    motor.add(groove);
  }

  const topRing = new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.011, 40), mats.machined);
  topRing.position.y = 0.109;
  topRing.castShadow = true;
  motor.add(topRing);

  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.067, 0.012, 32), mats.darkMetal);
  cap.position.y = 0.12;
  cap.castShadow = true;
  motor.add(cap);

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const b = bolt(0.0045, 0.004, mats.metal, 8);
    b.position.set(Math.cos(a) * 0.052, 0.1265, Math.sin(a) * 0.052);
    motor.add(b);
  }

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.018, 20), mats.metal);
  shaft.position.y = 0.134;
  motor.add(shaft);

  // ---- prop
  const handedness = sx * sz > 0 ? 1 : -1;
  const prop = createPropAssembly(mats, tex, handedness);
  prop.group.position.y = 0.143;
  const phases = { fl: 0.6, fr: 2.1, rl: 3.6, rr: 5.0 };
  prop.group.rotation.y = phases[id] ?? 0;
  motor.add(prop.group);

  return {
    motor,
    prop,
    glow,
    halo,
    light,
    ledColor,
    isFront,
    handedness,
    spinDir: handedness,
    ledSide: isRed ? 'port' : 'starboard',
  };
}

export function buildArms(mats, tex) {
  const group = new THREE.Group();
  group.name = 'arms';
  const motors = [];

  const quads = [
    { id: 'fl', sx: -1, sz: 1 },
    { id: 'fr', sx: 1, sz: 1 },
    { id: 'rl', sx: -1, sz: -1 },
    { id: 'rr', sx: 1, sz: -1 },
  ];

  const beamGeo = armBeam(mats);

  for (const q of quads) {
    const arm = new THREE.Group();
    arm.name = `arm-${q.id}`;
    arm.position.set(q.sx * ROOT.x, HULL_Y, q.sz * ROOT.z);
    arm.rotation.y = -Math.atan2(q.sz * DZ, q.sx * DX);

    const beam = beamGeo.clone();
    const beamMesh = new THREE.Mesh(beam, mats.carbon);
    beamMesh.castShadow = true;
    beamMesh.receiveShadow = true;
    arm.add(beamMesh);

    // arm root hinge / fairing
    const hinge = roundedBox(0.15, 0.114, 0.164, 0.024, 3, mats.trim);
    hinge.position.set(0.04, -0.002, 0);
    arm.add(hinge);
    const hingeTop = roundedBox(0.102, 0.013, 0.122, 0.008, 2, mats.plasticSoft);
    hingeTop.position.set(0.044, 0.058, 0);
    arm.add(hingeTop);
    const hingeBox = roundedBox(0.065, 0.05, 0.036, 0.008, 2, mats.plastic);
    hingeBox.position.set(0.1, 0.012, q.sz > 0 ? 0.084 : -0.084);
    arm.add(hingeBox);
    for (const side of [-1, 1]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.009, 20), mats.darkMetal);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(0.035, -0.01, side * 0.086);
      arm.add(screw);
      const s = bolt(0.0052, 0.003, mats.metal, 8);
      s.rotation.x = Math.PI / 2;
      s.position.set(0.035, -0.01, side * 0.092);
      arm.add(s);
    }

    // small top details near the hinge
    for (const zz of [-0.032, 0.032]) {
      const b = bolt(0.0042, 0.0024, mats.darkMetal, 8);
      b.position.set(0.175, beamTopY(0.175) + 0.0015, zz);
      arm.add(b);
    }
    const topInset = roundedBox(0.072, 0.0035, 0.046, 0.004, 1, mats.plasticSoft);
    topInset.position.set(0.25, beamTopY(0.25) + 0.0012, 0.006);
    arm.add(topInset);

    // motor / pod
    const m = buildMotor(mats, tex, q);
    arm.add(m.motor);

    // printed arm marking on the starboard rear arm
    if (q.id === 'rr') {
      const decal = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.05), mats.skypro);
      decal.rotation.x = -Math.PI / 2;
      decal.position.set(0.435, beamTopY(0.435) + 0.0023, 0);
      decal.renderOrder = 3;
      arm.add(decal);
    }

    // thin longitudinal seam on the arm's side
    for (const side of [-1, 1]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.0016, 0.0016), mats.trim);
      seam.position.set(0.33, -0.004, side * 0.0445);
      arm.add(seam);
    }

    group.add(arm);
    motors.push({ ...m, arm, id: q.id, sx: q.sx, sz: q.sz });
  }

  return { group, motors };
}
