import * as THREE from 'three';

export const PORTS = {
  // Navigation-light convention used on the model:
  // nose +Z + up +Y => port/left is +X, starboard/right is -X.
  // port = RED, starboard = GREEN.
  red: 0xff2618,
  green: 0x2bff72,
};

function ledMaterial(color) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color).multiplyScalar(0.22),
    emissive: new THREE.Color(color),
    emissiveIntensity: 2.8,
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 1,
    clearcoatRoughness: 0.1,
    transparent: true,
    opacity: 0.94,
    toneMapped: false,
  });
}

export function createMaterials(tex) {
  const carbon = new THREE.MeshPhysicalMaterial({
    color: 0xcdcdcd,
    map: tex.carbon.map,
    roughnessMap: tex.carbon.roughnessMap,
    bumpMap: tex.carbon.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.47,
    metalness: 0.22,
    clearcoat: 0.32,
    clearcoatRoughness: 0.42,
    envMapIntensity: 0.58,
  });

  const hull = new THREE.MeshPhysicalMaterial({
    color: 0x64666c,
    map: tex.graphite.map,
    roughnessMap: tex.graphite.roughnessMap,
    bumpMap: tex.graphite.bumpMap,
    bumpScale: 0.0012,
    roughness: 0.6,
    metalness: 0.2,
    clearcoat: 0.2,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.6,
  });

  const hullDark = hull.clone();
  hullDark.color = new THREE.Color(0x51535a);
  hullDark.roughness = 0.7;

  const trim = new THREE.MeshPhysicalMaterial({
    color: 0x141517,
    roughness: 0.48,
    metalness: 0.18,
    clearcoat: 0.3,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.7,
  });

  const plastic = new THREE.MeshPhysicalMaterial({
    color: 0x212226,
    roughness: 0.52,
    metalness: 0.12,
    clearcoat: 0.25,
    clearcoatRoughness: 0.55,
    envMapIntensity: 0.7,
  });

  const plasticSoft = new THREE.MeshPhysicalMaterial({
    color: 0x26272b,
    roughness: 0.66,
    metalness: 0.05,
    clearcoat: 0.12,
    envMapIntensity: 0.55,
  });

  const rubber = new THREE.MeshStandardMaterial({
    color: 0x121315,
    roughness: 0.82,
    metalness: 0.02,
  });

  const gear = new THREE.MeshPhysicalMaterial({
    color: 0x242529,
    roughness: 0.43,
    metalness: 0.28,
    clearcoat: 0.34,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.9,
  });

  const gearFacet = gear.clone();
  gearFacet.flatShading = true;
  gearFacet.color = new THREE.Color(0x202124);
  gearFacet.roughness = 0.46;
  gearFacet.needsUpdate = true;

  const metal = new THREE.MeshStandardMaterial({
    color: 0xb6b8bb,
    roughness: 0.27,
    metalness: 1,
    envMapIntensity: 1.15,
  });

  const darkMetal = new THREE.MeshStandardMaterial({
    color: 0x55575b,
    roughness: 0.36,
    metalness: 0.95,
    envMapIntensity: 1.0,
  });

  const machined = new THREE.MeshStandardMaterial({
    color: 0x86888c,
    roughness: 0.3,
    metalness: 1,
    envMapIntensity: 1.2,
  });

  const copper = new THREE.MeshStandardMaterial({
    color: 0x6e4a28,
    roughness: 0.6,
    metalness: 0.6,
    envMapIntensity: 0.8,
  });

  const prop = new THREE.MeshPhysicalMaterial({
    color: 0x303136,
    roughness: 0.56,
    metalness: 0.05,
    clearcoat: 0.1,
    clearcoatRoughness: 0.5,
    envMapIntensity: 0.8,
  });

  const propTip = new THREE.MeshPhysicalMaterial({
    color: 0xc0c1bb,
    roughness: 0.54,
    metalness: 0.1,
    clearcoat: 0.2,
    envMapIntensity: 0.9,
  });

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x040507,
    roughness: 0.045,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.2,
    reflectivity: 1.0,
  });

  const lensIris = new THREE.MeshPhysicalMaterial({
    color: 0x07100c,
    emissive: 0x123a26,
    emissiveIntensity: 0.2,
    roughness: 0.12,
    metalness: 0.45,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    envMapIntensity: 1.8,
  });

  const glassGreen = new THREE.MeshPhysicalMaterial({
    color: 0x081109,
    emissive: 0x0a2213,
    emissiveIntensity: 0.08,
    roughness: 0.07,
    metalness: 0.1,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 2.2,
  });

  const vent = new THREE.MeshStandardMaterial({
    map: tex.vent,
    transparent: true,
    alphaTest: 0.06,
    roughness: 0.58,
    metalness: 0.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });

  const logo = new THREE.MeshStandardMaterial({
    map: tex.logo,
    color: 0xa9aaa4,
    transparent: true,
    roughness: 0.4,
    metalness: 0.35,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const powerIcon = new THREE.MeshStandardMaterial({
    map: tex.power,
    transparent: true,
    roughness: 0.42,
    metalness: 0.25,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const skypro = new THREE.MeshStandardMaterial({
    map: tex.skypro,
    transparent: true,
    roughness: 0.48,
    metalness: 0.2,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -4,
    polygonOffsetUnits: -4,
  });

  const ledRed = ledMaterial(PORTS.red);
  const ledGreen = ledMaterial(PORTS.green);
  const ledCoreRed = new THREE.MeshBasicMaterial({ color: PORTS.red, toneMapped: false });
  const ledCoreGreen = new THREE.MeshBasicMaterial({ color: PORTS.green, toneMapped: false });
  const ledDimRed = new THREE.MeshBasicMaterial({ color: new THREE.Color(PORTS.red).multiplyScalar(0.95), toneMapped: false });
  const ledDimGreen = new THREE.MeshBasicMaterial({ color: new THREE.Color(PORTS.green).multiplyScalar(0.8), toneMapped: false });
  const ledLens = new THREE.MeshPhysicalMaterial({
    color: 0x1a1b1d,
    roughness: 0.08,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    transparent: true,
    opacity: 0.55,
    envMapIntensity: 1.4,
  });

  const glowRed = new THREE.SpriteMaterial({
    map: tex.glow,
    color: PORTS.red,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.9,
  });
  const glowGreen = glowRed.clone();
  glowGreen.color = new THREE.Color(PORTS.green);

  const contactShadow = new THREE.MeshBasicMaterial({
    map: tex.contactShadow,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    toneMapped: false,
  });

  const glassGlint = new THREE.MeshBasicMaterial({
    map: tex.lensGlint,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    toneMapped: false,
    opacity: 0.8,
  });

  return {
    carbon,
    hull,
    hullDark,
    trim,
    plastic,
    plasticSoft,
    rubber,
    gear,
    gearFacet,
    metal,
    darkMetal,
    machined,
    copper,
    prop,
    propTip,
    glass,
    lensIris,
    glassGreen,
    vent,
    logo,
    powerIcon,
    skypro,
    ledRed,
    ledGreen,
    ledCoreRed,
    ledCoreGreen,
    ledDimRed,
    ledDimGreen,
    ledLens,
    glowRed,
    glowGreen,
    contactShadow,
    glassGlint,
  };
}
