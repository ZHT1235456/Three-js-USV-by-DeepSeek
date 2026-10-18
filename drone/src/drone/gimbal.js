import * as THREE from 'three';
import {
  roundedBox,
  ring,
  bolt,
  cylinderBetween,
} from './parts.js';
import { HULL_Y } from './body.js';

function lensAssembly(mats, { radius = 0.06, glassRadius = 0.045 } = {}) {
  const g = new THREE.Group();

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.05, 0.055, 40), mats.trim);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = 0.028;
  barrel.castShadow = true;
  g.add(barrel);

  const step = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.9, radius * 0.96, 0.02, 40), mats.plasticSoft);
  step.rotation.x = Math.PI / 2;
  step.position.z = 0.06;
  g.add(step);

  const bezel = ring(radius * 0.84, 0.0042, mats.darkMetal, 48);
  bezel.position.z = 0.069;
  g.add(bezel);

  const glassGeo = new THREE.SphereGeometry(glassRadius, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.32);
  glassGeo.rotateX(Math.PI / 2);
  glassGeo.scale(1, 1, 0.5);
  const glass = new THREE.Mesh(glassGeo, mats.glassGreen);
  glass.position.z = 0.067;
  glass.castShadow = false;
  g.add(glass);

  const iris = new THREE.Mesh(new THREE.CircleGeometry(glassRadius * 0.44, 40), mats.lensIris);
  iris.position.z = 0.077;
  g.add(iris);
  const irisRing = ring(glassRadius * 0.46, 0.0015, mats.metal, 40);
  irisRing.position.z = 0.078;
  g.add(irisRing);

  const glintMat = mats.glassGlint.clone();
  glintMat.opacity = 0.45;
  const glint = new THREE.Mesh(new THREE.PlaneGeometry(glassRadius * 1.25, glassRadius * 1.25), glintMat);
  glint.position.set(-glassRadius * 0.22, glassRadius * 0.24, 0.0805);
  glint.renderOrder = 4;
  g.add(glint);

  // faint secondary reflection at lower right
  const glint2 = new THREE.Mesh(new THREE.PlaneGeometry(glassRadius * 0.5, glassRadius * 0.3), glintMat);
  glint2.position.set(glassRadius * 0.3, -glassRadius * 0.32, 0.0805);
  glint2.rotation.z = -0.4;
  glint2.renderOrder = 4;
  g.add(glint2);

  return g;
}

export function buildGimbal(mats, tex) {
  const root = new THREE.Group();
  root.name = 'gimbal';

  const yaw = new THREE.Group();
  yaw.position.set(0, HULL_Y - 0.157, 0.305);
  root.add(yaw);

  // yaw motor and top mounting plate
  const yawMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.054, 0.034, 28), mats.darkMetal);
  yawMotor.position.y = 0.008;
  yawMotor.castShadow = true;
  yaw.add(yawMotor);

  const yawRing = ring(0.055, 0.0035, mats.metal, 36);
  yawRing.rotation.x = Math.PI / 2;
  yawRing.position.y = -0.005;
  yaw.add(yawRing);

  // Solid mounting neck that seats the gimbal into the fuselage belly.
  // The previous design only had the slim yaw motor bridging the gap,
  // which could read as the camera floating under the airframe.
  const mountNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.086, 0.058, 0.075, 24, 1),
    mats.trim,
  );
  mountNeck.position.set(0, 0.014, 0.004);
  mountNeck.castShadow = true;
  mountNeck.receiveShadow = true;
  yaw.add(mountNeck);

  const neckFlange = ring(0.082, 0.005, mats.darkMetal, 36);
  neckFlange.rotation.x = Math.PI / 2;
  neckFlange.position.set(0, 0.043, 0.004);
  yaw.add(neckFlange);

  const neckCollar = ring(0.059, 0.0038, mats.darkMetal, 32);
  neckCollar.rotation.x = Math.PI / 2;
  neckCollar.position.set(0, -0.021, 0.004);
  yaw.add(neckCollar);

  const neckScrew = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0085, 0.0085, 0.006, 12),
    mats.metal,
  );
  neckScrew.rotation.x = Math.PI / 2;
  neckScrew.position.set(0, 0.014, 0.063);
  yaw.add(neckScrew);

  for (const sx of [-1, 1]) {
    const sideBolt = new THREE.Mesh(
      new THREE.CylinderGeometry(0.006, 0.006, 0.005, 10),
      mats.darkMetal,
    );
    sideBolt.rotation.z = Math.PI / 2;
    sideBolt.position.set(sx * 0.062, 0.017, 0.018);
    yaw.add(sideBolt);
  }

  const topPlate = roundedBox(0.158, 0.026, 0.112, 0.014, 2, mats.trim);
  topPlate.position.set(0, -0.016, 0.005);
  yaw.add(topPlate);

  for (const [x, z] of [
    [-0.057, -0.027],
    [0.057, -0.027],
    [-0.057, 0.037],
    [0.057, 0.037],
  ]) {
    const b = bolt(0.0048, 0.0026, mats.darkMetal, 8);
    b.position.set(x, -0.001, z);
    yaw.add(b);
  }

  // yoke
  for (const side of [-1, 1]) {
    const armPlate = roundedBox(0.023, 0.15, 0.056, 0.01, 2, mats.trim);
    armPlate.position.set(side * 0.126, -0.088, 0.032);
    armPlate.rotation.z = side * 0.02;
    yaw.add(armPlate);

    const anglePlate = roundedBox(0.05, 0.03, 0.075, 0.012, 2, mats.plastic);
    anglePlate.position.set(side * 0.112, -0.155, 0.045);
    yaw.add(anglePlate);

    const bearing = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.04, 0.026, 28), mats.darkMetal);
    bearing.rotation.z = Math.PI / 2;
    bearing.position.set(side * 0.128, -0.16, 0.052);
    yaw.add(bearing);

    const bRing = ring(0.029, 0.003, mats.metal, 28);
    bRing.rotation.y = Math.PI / 2;
    bRing.position.set(side * 0.142, -0.16, 0.052);
    yaw.add(bRing);

    const b = bolt(0.009, 0.004, mats.metal, 10);
    b.rotation.z = Math.PI / 2;
    b.position.set(side * 0.146, -0.16, 0.052);
    yaw.add(b);
  }

  // camera pivot
  const pivot = new THREE.Group();
  pivot.position.set(0, -0.163, 0.068);
  pivot.rotation.x = 0.018;
  yaw.add(pivot);

  const body = roundedBox(0.182, 0.158, 0.18, 0.03, 4, mats.plastic);
  body.castShadow = true;
  body.receiveShadow = true;
  pivot.add(body);

  // top plate detail of the camera housing
  const camTop = roundedBox(0.126, 0.013, 0.103, 0.01, 2, mats.trim);
  camTop.position.set(0, 0.083, -0.01);
  pivot.add(camTop);

  // front face plate
  const frontPlate = roundedBox(0.162, 0.146, 0.032, 0.023, 3, mats.trim);
  frontPlate.position.set(0, -0.002, 0.085);
  pivot.add(frontPlate);

  const lens = lensAssembly(mats, { radius: 0.056, glassRadius: 0.0395 });
  lens.position.set(0, 0.0, 0.092);
  pivot.add(lens);

  // side pitch-motor covers
  for (const side of [-1, 1]) {
    const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.049, 0.051, 0.036, 32), mats.plastic);
    cover.rotation.z = Math.PI / 2;
    cover.position.set(side * 0.1, -0.004, -0.002);
    cover.castShadow = true;
    pivot.add(cover);

    const coverRing = ring(0.04, 0.0026, mats.darkMetal, 32);
    coverRing.rotation.y = Math.PI / 2;
    coverRing.position.set(side * 0.119, -0.004, -0.002);
    pivot.add(coverRing);

    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.023, 0.023, 0.01, 24), mats.darkMetal);
    hub.rotation.z = Math.PI / 2;
    hub.position.set(side * 0.121, -0.004, -0.002);
    pivot.add(hub);

    const screw = bolt(0.009, 0.004, mats.metal, 8);
    screw.rotation.z = Math.PI / 2;
    screw.position.set(side * 0.127, -0.004, -0.002);
    pivot.add(screw);

    const upperScrew = bolt(0.0042, 0.0024, mats.darkMetal, 8);
    upperScrew.position.set(side * 0.06, 0.078, 0.072);
    pivot.add(upperScrew);
  }

  // bottom status LED (white)
  const ledMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const status = new THREE.Mesh(new THREE.CylinderGeometry(0.0065, 0.0065, 0.004, 16), ledMat);
  status.rotation.x = Math.PI / 2;
  status.position.set(0.043, -0.083, 0.071);
  pivot.add(status);
  const statusGlow = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex.glow,
    color: 0xffffff,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.5,
  }));
  statusGlow.scale.setScalar(0.035);
  statusGlow.position.copy(status.position);
  pivot.add(statusGlow);

  // soft feed cable
  const cablePts = [
    new THREE.Vector3(0.012, 0.0, -0.098),
    new THREE.Vector3(0.035, 0.045, -0.135),
    new THREE.Vector3(0.03, 0.098, -0.115),
    new THREE.Vector3(0.02, 0.135, -0.06),
  ];
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(cablePts), 28, 0.007, 8, false),
    mats.rubber,
  );
  cable.castShadow = true;
  pivot.add(cable);

  // mounting screws on the top plate
  for (const [x, z] of [
    [-0.055, -0.035],
    [0.055, -0.035],
    [-0.055, 0.04],
    [0.055, 0.04],
  ]) {
    const b = bolt(0.0045, 0.0025, mats.metal, 8);
    b.position.set(x, 0.09, z);
    pivot.add(b);
  }

  const s = 0.9;
  root.scale.setScalar(s);
  root.position.set(0, (HULL_Y - 0.157) * (1 - s), 0.305 * (1 - s));

  return { group: root, yaw, pivot, lens };
}
