import * as THREE from 'three';
import { buildBody, HULL_Y } from './body.js';
import { buildArms } from './arms.js';
import { buildGear } from './gear.js';
import { buildGimbal } from './gimbal.js';

export function buildDrone(mats, tex) {
  const group = new THREE.Group();
  group.name = 'skypro-xt';

  const body = buildBody(mats, tex);
  group.add(body.group);

  const arms = buildArms(mats, tex);
  group.add(arms.group);

  const gear = buildGear(mats);
  group.add(gear.group);

  const gimbal = buildGimbal(mats, tex);
  group.add(gimbal.group);

  // small belly vents / heatsink below the mid body
  for (let i = 0; i < 5; i++) {
    const slat = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.004, 0.007),
      mats.darkMetal,
    );
    slat.position.set(0, HULL_Y - 0.139, -0.14 - i * 0.014);
    group.add(slat);
  }

  const ledWorld = {};
  for (const m of arms.motors) {
    if (!m.isFront) continue;
    const p = new THREE.Vector3(0, -0.055, 0);
    m.motor.localToWorld(p);
    ledWorld[m.ledSide] = p.clone();
  }

  group.traverse((o) => {
    if (o.isMesh && !o.userData.noShadow) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  // decals / glow should not receive hard shadows
  group.traverse((o) => {
    if (o.isMesh && o.material && o.material.transparent) {
      o.castShadow = false;
      o.receiveShadow = false;
    }
  });

  return { group, body, arms, gear, gimbal, motors: arms.motors, ledWorld };
}
