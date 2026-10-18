import * as THREE from 'three';

export function createMaterials(textures) {
  const pearlWhite = new THREE.MeshPhysicalMaterial({
    name: 'Pearl composite',
    color: 0xe9e6dc,
    roughness: 0.28,
    metalness: 0.035,
    clearcoat: 1,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.92
  });

  const pureWhite = new THREE.MeshPhysicalMaterial({
    name: 'Pure white composite',
    color: 0xf0ede3,
    roughness: 0.34,
    metalness: 0.012,
    clearcoat: 0.82,
    clearcoatRoughness: 0.19,
    envMapIntensity: 0.82
  });

  const satinWhite = new THREE.MeshPhysicalMaterial({
    name: 'Satin composite',
    color: 0xdcd9cf,
    roughness: 0.48,
    metalness: 0.03,
    clearcoat: 0.4,
    clearcoatRoughness: 0.32,
    envMapIntensity: 0.8
  });

  const lowerHull = new THREE.MeshPhysicalMaterial({
    name: 'Deep water composite',
    color: 0x0a1a1b,
    roughness: 0.26,
    metalness: 0.28,
    clearcoat: 1,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.35
  });

  const ink = new THREE.MeshPhysicalMaterial({
    name: 'Ink painted metal',
    color: 0x111b1b,
    roughness: 0.36,
    metalness: 0.35,
    clearcoat: 0.7,
    clearcoatRoughness: 0.18,
    envMapIntensity: 1.0
  });

  const ember = new THREE.MeshPhysicalMaterial({
    name: 'Signal orange',
    color: 0xdf5e3d,
    roughness: 0.32,
    metalness: 0.04,
    clearcoat: 0.9,
    clearcoatRoughness: 0.16,
    envMapIntensity: 0.9
  });

  const emberMatte = new THREE.MeshStandardMaterial({
    name: 'Signal orange matte',
    color: 0xd45939,
    roughness: 0.58,
    metalness: 0.05
  });

  const teak = new THREE.MeshPhysicalMaterial({
    name: 'Teak',
    map: textures.teak,
    color: 0xffffff,
    roughness: 0.51,
    metalness: 0.0,
    clearcoat: 0.28,
    clearcoatRoughness: 0.3,
    envMapIntensity: 0.65
  });

  const carbon = new THREE.MeshPhysicalMaterial({
    name: 'Carbon',
    map: textures.carbon,
    color: 0xffffff,
    roughness: 0.34,
    metalness: 0.5,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
    envMapIntensity: 1.2
  });

  const carbonMatte = new THREE.MeshStandardMaterial({
    name: 'Carbon matte',
    map: textures.carbon,
    color: 0xb3b9b5,
    roughness: 0.62,
    metalness: 0.2
  });

  const polished = new THREE.MeshPhysicalMaterial({
    name: 'Polished stainless',
    color: 0xdde2dd,
    roughness: 0.105,
    metalness: 1.0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.7
  });

  const brushed = new THREE.MeshPhysicalMaterial({
    name: 'Brushed stainless',
    color: 0xbfc7c2,
    roughness: 0.27,
    metalness: 1.0,
    clearcoat: 0.2,
    envMapIntensity: 1.3
  });

  const titanium = new THREE.MeshPhysicalMaterial({
    name: 'Titanium',
    color: 0x727c78,
    roughness: 0.31,
    metalness: 0.9,
    envMapIntensity: 1.05
  });

  const bronze = new THREE.MeshPhysicalMaterial({
    name: 'Bronze',
    color: 0x94735a,
    roughness: 0.25,
    metalness: 1.0,
    clearcoat: 0.4,
    envMapIntensity: 1.2
  });

  const darkMetal = new THREE.MeshPhysicalMaterial({
    name: 'Anodised alloy',
    color: 0x202724,
    roughness: 0.3,
    metalness: 0.83,
    clearcoat: 0.65,
    clearcoatRoughness: 0.2,
    envMapIntensity: 1.0
  });

  const rubber = new THREE.MeshStandardMaterial({
    name: 'Rubber',
    color: 0x111615,
    roughness: 0.86,
    metalness: 0.0
  });

  const glass = new THREE.MeshPhysicalMaterial({
    name: 'Smoked glass',
    color: 0x050d0e,
    roughness: 0.07,
    metalness: 0.22,
    clearcoat: 0.78,
    clearcoatRoughness: 0.055,
    transparent: true,
    opacity: 0.93,
    envMapIntensity: 0.8,
    depthWrite: false
  });

  const glassLight = new THREE.MeshPhysicalMaterial({
    name: 'Clear glass',
    color: 0x8fa7a0,
    roughness: 0.04,
    metalness: 0.05,
    transparent: true,
    opacity: 0.42,
    clearcoat: 1,
    envMapIntensity: 1.9,
    depthWrite: false,
    side: THREE.DoubleSide
  });

  const solar = new THREE.MeshPhysicalMaterial({
    name: 'Solar array',
    map: textures.solar,
    color: 0xffffff,
    roughness: 0.32,
    metalness: 0.26,
    clearcoat: 0.58,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.82
  });

  const interior = new THREE.MeshPhysicalMaterial({
    name: 'Payload bay',
    color: 0x0b1211,
    roughness: 0.65,
    metalness: 0.15
  });

  const interiorPanel = new THREE.MeshStandardMaterial({
    name: 'Payload bay panel',
    color: 0x17201e,
    roughness: 0.48,
    metalness: 0.35
  });

  const screen = new THREE.MeshBasicMaterial({
    name: 'Mission display',
    map: textures.plotter,
    toneMapped: false
  });

  const warmLight = new THREE.MeshBasicMaterial({
    name: 'Warm LED',
    color: 0xffd7a0,
    toneMapped: false
  });

  const coolLight = new THREE.MeshBasicMaterial({
    name: 'Cool LED',
    color: 0xd8fff4,
    toneMapped: false
  });

  const navRed = new THREE.MeshBasicMaterial({
    name: 'Port navigation light',
    color: 0xff271f,
    toneMapped: false
  });

  const navGreen = new THREE.MeshBasicMaterial({
    name: 'Starboard navigation light',
    color: 0x52ffbc,
    toneMapped: false
  });

  const amberLight = new THREE.MeshBasicMaterial({
    name: 'Amber status light',
    color: 0xffa52f,
    toneMapped: false
  });

  const tealGlow = new THREE.MeshBasicMaterial({
    name: 'Teal status light',
    color: 0x6ff6d5,
    toneMapped: false
  });

  const hullDecal = new THREE.MeshPhysicalMaterial({
    name: 'Hull identity',
    map: textures.hullName,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    roughness: 0.38,
    metalness: 0.0,
    clearcoat: 0.45,
    side: THREE.DoubleSide
  });

  const transomDecal = new THREE.MeshPhysicalMaterial({
    name: 'Transom identity',
    map: textures.transomName,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    roughness: 0.4,
    metalness: 0.0,
    side: THREE.DoubleSide
  });

  const wakeWhite = new THREE.MeshBasicMaterial({
    name: 'Wake white',
    color: 0xb7d2c8,
    transparent: true,
    opacity: 0.28,
    depthWrite: false
  });

  return {
    pearlWhite,
    pureWhite,
    satinWhite,
    lowerHull,
    ink,
    ember,
    emberMatte,
    teak,
    carbon,
    carbonMatte,
    polished,
    brushed,
    titanium,
    bronze,
    darkMetal,
    rubber,
    glass,
    glassLight,
    solar,
    interior,
    interiorPanel,
    screen,
    warmLight,
    coolLight,
    navRed,
    navGreen,
    amberLight,
    tealGlow,
    hullDecal,
    transomDecal,
    wakeWhite
  };
}
