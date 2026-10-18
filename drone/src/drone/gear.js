import * as THREE from 'three';
import {
  cylinderBetween,
  capsuleBetween,
  roundedBox,
  ring,
  bolt,
} from './parts.js';
import { HULL_Y } from './body.js';

const RAIL_Y = 0.036;
const RAIL_R = 0.029;
const SKID_X = 0.405;
const SKID_FRONT = 0.448;
const SKID_BACK = -0.448;
const LEG_BOTTOM_Z = [0.302, -0.312];
const KNEE_X = 0.298;
const KNEE_Y = 0.305;
const LEG_TOP_X = 0.177;
const LEG_TOP_Y = HULL_Y - 0.133;

/**
 * Longitudinal landing skids: one rail per side running nose-to-tail,
 * with a front and a rear strut per rail. The whole assembly is the
 * previous transverse layout rotated 90 degrees about Y, with the
 * upper strut ends re-seated on the four fuselage hardpoints.
 */
export function buildGear(mats) {
  const group = new THREE.Group();
  group.name = 'landing-gear';
  const v = (x, y, z) => new THREE.Vector3(x, y, z);

  for (const side of [-1, 1]) {
    const x = side * SKID_X;

    // longitudinal skid rail
    const rail = cylinderBetween(
      v(x, RAIL_Y, SKID_BACK),
      v(x, RAIL_Y, SKID_FRONT),
      RAIL_R,
      mats.gear,
      18,
    );
    group.add(rail);

    // rounded fore / aft end caps, slightly larger than the rail
    for (const dir of [-1, 1]) {
      const zEnd = dir > 0 ? SKID_FRONT : SKID_BACK;
      const cap = capsuleBetween(
        v(x, RAIL_Y, zEnd - dir * 0.012),
        v(x, RAIL_Y, zEnd + dir * 0.038),
        0.0345,
        mats.plasticSoft,
        18,
      );
      group.add(cap);

      const endPlug = bolt(0.0135, 0.006, mats.darkMetal, 20);
      endPlug.rotation.x = Math.PI / 2;
      endPlug.position.set(x, RAIL_Y, zEnd + dir * 0.075);
      group.add(endPlug);
    }

    // front and rear struts
    for (let li = 0; li < 2; li++) {
      const bottomZ = LEG_BOTTOM_Z[li];
      const topZ = li === 0 ? 0.335 : -0.335;
      const kneeZ = bottomZ + (topZ - bottomZ) * 0.5;
      const bottom = v(x, RAIL_Y, bottomZ);
      const knee = v(side * KNEE_X, KNEE_Y, kneeZ);
      const top = v(side * LEG_TOP_X, LEG_TOP_Y, topZ);

      const lower = cylinderBetween(bottom, knee, 0.0235, mats.gear, 16, 0.0225);
      const upper = cylinderBetween(knee, top, 0.0225, mats.gear, 16, 0.019);
      group.add(lower, upper);

      // knee sleeve
      const dir = new THREE.Vector3().subVectors(top, knee).normalize();
      const sleeveStart = knee.clone().addScaledVector(dir, -0.03);
      const sleeveEnd = knee.clone().addScaledVector(dir, 0.042);
      const sleeve = cylinderBetween(sleeveStart, sleeveEnd, 0.0325, mats.plastic, 18, 0.031);
      group.add(sleeve);

      const sleeveRing = new THREE.Mesh(new THREE.TorusGeometry(0.0328, 0.0018, 6, 22), mats.trim);
      sleeveRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
      sleeveRing.position.copy(knee).addScaledVector(dir, -0.028);
      group.add(sleeveRing);

      const kneeScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.0085, 0.0085, 0.004, 12), mats.metal);
      kneeScrew.rotation.z = Math.PI / 2;
      kneeScrew.position.set(knee.x + side * 0.033, knee.y, knee.z);
      group.add(kneeScrew);

      // foot collar where the strut meets the rail
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.033, 0.07, 18), mats.plastic);
      foot.position.set(x, RAIL_Y, bottomZ);
      group.add(foot);

      const footRing = ring(0.0325, 0.0022, mats.trim, 24);
      footRing.rotation.x = -Math.PI / 2;
      footRing.position.set(x, RAIL_Y - 0.033, bottomZ);
      group.add(footRing);

      // top ball joint and mounting plate against the fuselage
      const ball = new THREE.Mesh(new THREE.SphereGeometry(0.029, 18, 12), mats.plastic);
      ball.position.copy(top);
      group.add(ball);

      const collar = cylinderBetween(
        top.clone().add(v(0, 0.015, 0)),
        top.clone().add(v(0, 0.06, 0)),
        0.027,
        mats.trim,
        18,
        0.031,
      );
      group.add(collar);

      const plate = roundedBox(0.075, 0.028, 0.09, 0.01, 2, mats.trim);
      plate.position.set(top.x, LEG_TOP_Y + 0.088, top.z);
      plate.rotation.z = side > 0 ? -0.1 : 0.1;
      group.add(plate);

      const boltHead = bolt(0.006, 0.003, mats.metal, 8);
      boltHead.position.set(top.x, LEG_TOP_Y + 0.104, top.z);
      group.add(boltHead);
    }
  }

  return { group, railY: RAIL_Y };
}
