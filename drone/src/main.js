import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';

import '@fontsource/instrument-serif/400.css';
import '@fontsource/instrument-serif/400-italic.css';
import '@fontsource/manrope/200.css';
import '@fontsource/manrope/300.css';
import '@fontsource/manrope/400.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';

import { createTextures } from './drone/textures.js';
import { createMaterials } from './drone/materials.js';
import { buildDrone } from './drone/index.js';

const params = new URLSearchParams(window.location.search);
const IS_STATIC = params.has('static');
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const $ = (sel, root = document) => root.querySelector(sel);

const el = {
  stage: $('#stage'),
  loader: $('#loader'),
  loaderBar: $('#loaderBar'),
  loaderPct: $('#loaderPct'),
  coords: $('#coords'),
  hotspots: $('#hotspots'),
  navInfo: $('#navInfo'),
  lightPanel: $('#lightPanel'),
  lightClose: $('#lightClose'),
  resetView: $('#resetView'),
  toggleOrbit: $('#toggleOrbit'),
  toggleRotors: $('#toggleRotors'),
  toggleLabels: $('#toggleLabels'),
  toggleNight: $('#toggleNight'),
  viewButtons: Array.from(document.querySelectorAll('.view')),
};

const VIEWS = {
  hero: {
    pos: new THREE.Vector3(-2.36, 1.6, 2.95),
    target: new THREE.Vector3(0, 0.47, 0),
    fov: 31,
  },
  front: {
    pos: new THREE.Vector3(0.02, 1.18, 4.35),
    target: new THREE.Vector3(0, 0.47, 0),
    fov: 31,
  },
  top: {
    pos: new THREE.Vector3(0.02, 5.05, 0.68),
    target: new THREE.Vector3(0, 0.48, 0),
    fov: 31,
  },
  rear: {
    pos: new THREE.Vector3(2.72, 1.62, -3.5),
    target: new THREE.Vector3(0, 0.47, 0),
    fov: 31,
  },
  detail: {
    pos: new THREE.Vector3(0.92, 0.92, 2.3),
    target: new THREE.Vector3(0, 0.39, 0.34),
    fov: 31,
  },
};

const state = {
  view: 'hero',
  orbit: !IS_STATIC && !prefersReducedMotion,
  rotors: false,
  labels: false,
  night: false,
  panelOpen: false,
  rotorSpeed: 0,
  themeMix: 0,
};

let renderer;
let scene;
let camera;
let controls;
let drone;
let mats;
let tex;
let stageW = 1;
let stageH = 1;
let fit = 1;
let camTween = null;
let lastInteraction = -100000;
let introPlayed = IS_STATIC;
let ready = false;

const hotspotsData = [
  {
    id: 'airframe',
    name: '碳纤维一体机身',
    en: 'CARBON MONOCOQUE',
    point: new THREE.Vector3(0.0, 0.862, -0.02),
    side: 'right',
    dx: -18,
    dy: -34,
  },
  {
    id: 'rotor',
    name: '三叶低噪桨',
    en: '3-BLADE ROTOR',
    point: new THREE.Vector3(0.99, 0.865, 0.6),
    side: 'left',
    dx: 8,
    dy: -22,
  },
  {
    id: 'nav',
    name: '左舷航行灯 · 红',
    en: 'PORT NAV LIGHT',
    point: new THREE.Vector3(0.74, 0.655, 0.575),
    side: 'left',
    dx: -12,
    dy: 10,
  },
  {
    id: 'gimbal',
    name: '三轴机械云台',
    en: '3-AXIS GIMBAL',
    point: new THREE.Vector3(0.03, 0.31, 0.53),
    side: 'right',
    dx: 10,
    dy: 34,
  },
  {
    id: 'gear',
    name: '避震起落架',
    en: 'DAMPED GEAR',
    point: new THREE.Vector3(0.405, 0.12, 0.18),
    side: 'right',
    dx: 28,
    dy: 112,
  },
];

const hotspotEls = [];

function makeHotspots() {
  for (const h of hotspotsData) {
    const wrap = document.createElement('div');
    wrap.className = `hotspot hotspot--${h.side}`;
    wrap.dataset.id = h.id;
    wrap.innerHTML = `
      <i class="hotspot__dot"></i>
      <span class="hotspot__tag" style="--dx:${h.dx || 0}px;--dy:${h.dy || 0}px">
        <span class="hotspot__line"></span>
        <span class="hotspot__label"><b>${h.name}</b><span>${h.en}</span></span>
      </span>
    `;
    el.hotspots.appendChild(wrap);
    hotspotEls.push({ el: wrap, point: h.point, dx: h.dx || 0, dy: h.dy || 0, side: h.side });
  }
}

function setProgress(p) {
  const v = Math.max(0, Math.min(100, p));
  el.loaderBar.style.width = `${v}%`;
  el.loaderPct.textContent = String(Math.round(v)).padStart(2, '0');
}

function setTheme(isNight) {
  state.night = isNight;
  document.body.dataset.theme = isNight ? 'night' : 'studio';
  el.toggleNight.classList.toggle('is-on', isNight);
  el.toggleNight.setAttribute('aria-pressed', String(isNight));
}

function setOrbit(on) {
  state.orbit = on;
  el.toggleOrbit.classList.toggle('is-on', on);
  el.toggleOrbit.setAttribute('aria-pressed', String(on));
}

function setRotors(on) {
  state.rotors = on;
  el.toggleRotors.classList.toggle('is-on', on);
  el.toggleRotors.setAttribute('aria-pressed', String(on));
}

function setLabels(on) {
  state.labels = on;
  el.hotspots.classList.toggle('is-visible', on);
  el.toggleLabels.classList.toggle('is-on', on);
  el.toggleLabels.setAttribute('aria-pressed', String(on));
}

function openPanel(open) {
  state.panelOpen = open;
  el.lightPanel.classList.toggle('is-open', open);
  el.lightPanel.setAttribute('aria-hidden', String(!open));
  el.navInfo.setAttribute('aria-expanded', String(open));
}

function updateViewButtons(name) {
  for (const b of el.viewButtons) b.classList.toggle('is-active', b.dataset.view === name);
}

function computeFit() {
  const aspect = stageW / Math.max(1, stageH);
  // narrow / portrait stages need more breathing room around the 2.1 m rotor span
  return Math.max(1, Math.min(1.9, 1.18 / Math.max(0.55, aspect)));
}

function viewPose(name, fitValue = fit) {
  const v = VIEWS[name];
  const dir = new THREE.Vector3().subVectors(v.pos, v.target);
  const target = v.target.clone();
  if (name === 'detail') dir.multiplyScalar(Math.max(1, fitValue * 0.78));
  else dir.multiplyScalar(fitValue);
  return { pos: target.clone().add(dir), target };
}

function applyViewPose(pose) {
  camera.position.copy(pose.pos);
  controls.target.copy(pose.target);
  camera.updateProjectionMatrix();
  controls.update();
}

function setView(name, { instant = false, duration = 1.25 } = {}) {
  if (!VIEWS[name]) return;
  state.view = name;
  updateViewButtons(name);
  lastInteraction = performance.now();
  fit = computeFit();
  const pose = viewPose(name, fit);

  if (instant || IS_STATIC) {
    applyViewPose(pose);
    camTween = null;
    controls.enabled = true;
    return;
  }

  controls.enabled = false;
  camTween = {
    fromPos: camera.position.clone(),
    toPos: pose.pos,
    fromTarget: controls.target.clone(),
    toTarget: pose.target,
    t: 0,
    duration,
    arc: name === 'top' ? 0.2 : 0.08,
  };
}

function cancelTween() {
  if (!camTween) return;
  camTween = null;
  controls.enabled = true;
}

function stepCamera(dt) {
  if (!camTween) return;
  const tw = camTween;
  tw.t += dt / tw.duration;
  const t = Math.min(1, tw.t);
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  camera.position.lerpVectors(tw.fromPos, tw.toPos, e);
  // slight arc so the camera sweeps rather than slides
  camera.position.y += Math.sin(Math.PI * e) * tw.arc;
  controls.target.lerpVectors(tw.fromTarget, tw.toTarget, e);
  if (t >= 1) {
    camera.position.copy(tw.toPos);
    controls.target.copy(tw.toTarget);
    camTween = null;
    controls.enabled = true;
    controls.update();
  }
}

function updateHotspots() {
  if (!state.labels) return;
  const stageRect = el.stage.getBoundingClientRect();
  const v = new THREE.Vector3();
  for (const item of hotspotEls) {
    v.copy(item.point).project(camera);
    const behind = v.z > 1;
    const x = stageRect.left + (v.x * 0.5 + 0.5) * stageRect.width;
    const y = stageRect.top + (-v.y * 0.5 + 0.5) * stageRect.height;
    const visible = !behind && x > -80 && x < window.innerWidth + 80 && y > -40 && y < window.innerHeight + 40;
    let leftSide = item.side === 'left';
    if (x > window.innerWidth * 0.67) leftSide = true;
    if (x < window.innerWidth * 0.26) leftSide = false;
    item.el.classList.toggle('hotspot--left', leftSide);
    item.el.style.display = visible ? '' : 'none';
    item.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
  }
}

function makeStudioEnvironment() {
  // procedural equirectangular studio: broad overhead softbox, warm and cool
  // side cards and a soft floor bounce. Used only for IBL / reflections.
  const cw = 1024;
  const ch = 512;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');

  const base = ctx.createLinearGradient(0, 0, 0, ch);
  base.addColorStop(0, '#2c2e33');
  base.addColorStop(0.38, '#6a6c69');
  base.addColorStop(0.52, '#8c8b84');
  base.addColorStop(0.72, '#5a5852');
  base.addColorStop(1, '#232425');
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, cw, ch);

  const soft = (x, y, rx, ry, color, opacity) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry));
    g.addColorStop(0, color.replace('ALPHA', String(opacity)));
    g.addColorStop(0.5, color.replace('ALPHA', String(opacity * 0.35)));
    g.addColorStop(1, color.replace('ALPHA', '0'));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, ry / rx);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    ctx.restore();
  };

  // overhead strip
  ctx.save();
  ctx.filter = 'blur(28px)';
  ctx.fillStyle = 'rgba(255,252,244,0.95)';
  ctx.beginPath();
  ctx.ellipse(cw * 0.5, ch * 0.13, cw * 0.3, ch * 0.075, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.beginPath();
  ctx.ellipse(cw * 0.52, ch * 0.2, cw * 0.18, ch * 0.05, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // warm card camera-left
  soft(cw * 0.18, ch * 0.42, cw * 0.115, ch * 0.22, 'rgba(255,236,214,ALPHA)', 0.85);
  // cool card camera-right
  soft(cw * 0.84, ch * 0.36, cw * 0.1, ch * 0.2, 'rgba(223,238,255,ALPHA)', 0.75);
  // soft floor bounce
  const bounce = ctx.createLinearGradient(0, ch * 0.52, 0, ch);
  bounce.addColorStop(0, 'rgba(240,236,226,0)');
  bounce.addColorStop(0.35, 'rgba(240,236,226,0.18)');
  bounce.addColorStop(1, 'rgba(240,236,226,0.02)');
  ctx.fillStyle = bounce;
  ctx.fillRect(0, ch * 0.52, cw, ch * 0.48);

  // faint dark gobo bands to give gloss highlights some shape
  ctx.save();
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = '#1b1c1e';
    const x = cw * (0.05 + i * 0.19);
    ctx.fillRect(x, ch * 0.24, cw * 0.025, ch * 0.2);
  }
  ctx.restore();

  const envMap = new THREE.CanvasTexture(canvas);
  envMap.mapping = THREE.EquirectangularReflectionMapping;
  envMap.colorSpace = THREE.SRGBColorSpace;
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromEquirectangular(envMap);
  scene.environment = rt.texture;
  scene.environmentIntensity = 1.35;
  envMap.dispose();
  pmrem.dispose();
}

function setupLights() {
  const hemi = new THREE.HemisphereLight(0xf7f4ed, 0x8d8679, 0.55);
  scene.add(hemi);

  const key = new THREE.DirectionalLight(0xfff5e8, 3.6);
  key.position.set(-3.0, 7.0, 3.6);
  key.target.position.set(0, 0.45, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -2.5;
  key.shadow.camera.right = 2.5;
  key.shadow.camera.top = 2.5;
  key.shadow.camera.bottom = -2.5;
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far = 14;
  key.shadow.bias = -0.0007;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);

  const fill = new THREE.DirectionalLight(0xdde7f2, 1.25);
  fill.position.set(-4.6, 2.8, 4.2);
  scene.add(fill);

  const rim = new THREE.DirectionalLight(0xfff2e0, 1.9);
  rim.position.set(1.6, 3.6, -4.6);
  scene.add(rim);

  const rimR = new THREE.DirectionalLight(0xe6efff, 0.7);
  rimR.position.set(-4.4, 2.2, -2.6);
  scene.add(rimR);

  RectAreaLightUniformsLib.init();
  const softbox = new THREE.RectAreaLight(0xfff8ee, 6.0, 4.6, 3.4);
  softbox.position.set(-1.7, 3.5, 3.0);
  softbox.lookAt(0, 0.5, 0);
  scene.add(softbox);

  const nightRim = new THREE.DirectionalLight(0x9fc4dd, 0);
  nightRim.position.set(2.4, 3.8, -4.0);
  scene.add(nightRim);

  return { hemi, key, fill, rim, rimR, softbox, nightRim };
}

function setupGround() {
  const shadowMat = new THREE.ShadowMaterial({ color: 0x151310, opacity: 0.13 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), shadowMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  floor.receiveShadow = true;
  scene.add(floor);

  const contact = new THREE.Mesh(new THREE.PlaneGeometry(4.0, 3.2), mats.contactShadow);
  contact.rotation.x = -Math.PI / 2;
  contact.position.set(0, 0.002, -0.01);
  contact.renderOrder = 1;
  contact.material.opacity = 0.42;
  scene.add(contact);

  return { floor, shadowMat, contact };
}

async function init() {
  el.stage.classList.add('is-booting');

  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.18;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.setClearColor(0x000000, 0);
  el.stage.appendChild(renderer.domElement);

  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(31, 1, 0.05, 80);

  makeStudioEnvironment();
  lights = setupLights();

  tex = await createTextures(renderer);
  mats = createMaterials(tex);

  drone = buildDrone(mats, tex);
  scene.add(drone.group);

  ground = setupGround();


  const rect = el.stage.getBoundingClientRect();
  stageW = Math.max(1, rect.width);
  stageH = Math.max(1, rect.height);
  renderer.setSize(stageW, stageH, false);
  camera.aspect = stageW / stageH;
  updateProjection();

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.062;
  controls.enablePan = false;
  controls.minDistance = 1.35;
  controls.maxDistance = 8.5;
  controls.minPolarAngle = 0.055;
  controls.maxPolarAngle = Math.PI * 0.492;
  controls.autoRotate = state.orbit;
  controls.autoRotateSpeed = 0.32;
  controls.target.copy(VIEWS.hero.target);

  controls.addEventListener('start', () => {
    lastInteraction = performance.now();
    if (camTween) cancelTween();
  });
  controls.addEventListener('end', () => {
    lastInteraction = performance.now();
  });

  fit = computeFit();
  const initialName = VIEWS[params.get('view')] ? params.get('view') : 'hero';
  state.view = initialName;
  updateViewButtons(initialName);
  const pose = viewPose(initialName, fit);
  applyViewPose(pose);

  if (!IS_STATIC) {
    const introPos = camera.position.clone().sub(controls.target).multiplyScalar(1.16).add(controls.target);
    introPos.x -= 0.32;
    introPos.y += 0.12;
    camera.position.copy(introPos);
    camTween = {
      fromPos: introPos,
      toPos: pose.pos,
      fromTarget: controls.target.clone(),
      toTarget: pose.target,
      t: 0,
      duration: 2.1,
      arc: 0.06,
    };
    controls.enabled = false;
    lastInteraction = performance.now();
  }

  makeHotspots();
  setLabels(params.has('labels'));
  setTheme(params.get('theme') === 'night');
  state.themeMix = state.night ? 1 : 0;
  setOrbit(state.orbit);

  wireUI(lights, ground);

  const resize = () => {
    const r = el.stage.getBoundingClientRect();
    stageW = Math.max(1, r.width);
    stageH = Math.max(1, r.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(stageW, stageH, false);
    camera.aspect = stageW / stageH;
    fit = computeFit();
    updateProjection();
    if (!camTween) {
      const tw = new THREE.Vector3().subVectors(camera.position, controls.target);
      const base = new THREE.Vector3().subVectors(VIEWS[state.view].pos, VIEWS[state.view].target).length();
      const desired = base * (state.view === 'detail' ? Math.max(1, fit * 0.78) : fit);
      tw.setLength(desired);
      camera.position.copy(controls.target).add(tw);
      controls.update();
    }
  };
  new ResizeObserver(resize).observe(el.stage);
  window.addEventListener('resize', resize);

  renderer.compile(scene, camera);
  ready = true;

  animate();
}

function updateProjection() {
  if (!camera) return;
  camera.fov = 31;
  camera.updateProjectionMatrix();
}

function wireUI(lights, ground) {
  el.viewButtons.forEach((b) => {
    b.addEventListener('click', () => {
      setView(b.dataset.view);
    });
  });

  el.toggleOrbit.addEventListener('click', () => {
    setOrbit(!state.orbit);
    lastInteraction = performance.now();
  });

  el.toggleRotors.addEventListener('click', () => {
    setRotors(!state.rotors);
  });

  el.toggleLabels.addEventListener('click', () => {
    setLabels(!state.labels);
  });

  el.toggleNight.addEventListener('click', () => {
    setTheme(!state.night);
  });

  el.navInfo.addEventListener('click', () => openPanel(!state.panelOpen));
  el.lightClose.addEventListener('click', () => openPanel(false));
  el.resetView?.addEventListener('click', () => {
    openPanel(false);
    setView('hero');
  });

  document.addEventListener('pointerdown', (e) => {
    if (!state.panelOpen) return;
    if (el.lightPanel.contains(e.target) || el.navInfo.contains(e.target)) return;
    openPanel(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.key === 'Escape') {
      openPanel(false);
      return;
    }
    const names = ['hero', 'front', 'top', 'rear', 'detail'];
    const n = Number(e.key);
    if (n >= 1 && n <= 5) setView(names[n - 1]);
    if (e.key === 'o' || e.key === 'O') setOrbit(!state.orbit);
    if (e.key === 'r' || e.key === 'R') setRotors(!state.rotors);
    if (e.key === 'l' || e.key === 'L') setLabels(!state.labels);
    if (e.key === 'n' || e.key === 'N') setTheme(!state.night);
  });

  renderer.domElement.addEventListener('dblclick', () => {
    setView('hero');
  });

  // pause auto orbit temporarily after any canvas interaction
  renderer.domElement.addEventListener('pointerdown', () => {
    lastInteraction = performance.now();
  });

  el.lightPanel.setAttribute('aria-hidden', 'true');
}

function smooth(current, target, lambda, dt) {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

let lastFrame = performance.now();
function animate(nowArg) {
  requestAnimationFrame(animate);
  const now = nowArg ?? performance.now();
  const dt = Math.min(0.05, (now - lastFrame) / 1000 || 0.016);
  lastFrame = now;
  const t = now / 1000;

  stepCamera(dt);

  // auto orbit resumes after a short idle period
  const idle = performance.now() - lastInteraction > 7000;
  controls.autoRotate = state.orbit && !camTween && idle && !IS_STATIC;

  // rotors
  const targetSpeed = state.rotors ? 1 : 0;
  state.rotorSpeed = smooth(state.rotorSpeed, targetSpeed, state.rotors ? 2.0 : 3.2, dt);
  const speed = state.rotorSpeed;
  for (const m of drone.motors) {
    m.prop.rotor.rotation.y += speed * m.spinDir * dt * 34;
    m.prop.blur.rotation.z += speed * m.spinDir * dt * 1.1;
    const blurTarget = Math.max(0, (speed - 0.22) / 0.78) * 0.92;
    m.prop.blurMaterial.opacity = smooth(m.prop.blurMaterial.opacity, blurTarget, 4, dt);
  }

  // theme transition
  state.themeMix = smooth(Number.isFinite(state.themeMix) ? state.themeMix : 0, state.night ? 1 : 0, 3.4, dt);
  const tm = Math.min(1, Math.max(0, Number.isFinite(state.themeMix) ? state.themeMix : 0));
  renderer.toneMappingExposure = 1.18 + 0.2 * tm;
  scene.environmentIntensity = 1.35 - 1.12 * tm;
  setupLightsRefs(
    lights,
    tm,
  );

  // subtle nav-light breathing
  for (const m of drone.motors) {
    if (!m.isFront) continue;
    if (m.glow) {
      const pulse = 0.93 + 0.07 * Math.sin(t * 1.6 + (m.ledSide === 'port' ? 0 : Math.PI));
      m.glow.material.opacity = (0.62 + 0.38 * tm) * pulse;
      m.glow.scale.setScalar(0.10 + 0.06 * tm);
    }
    if (m.light) m.light.intensity = 0.05 + 1.45 * tm;
    if (m.halo) {
      m.halo.material.opacity = 0.5 * tm;
      m.halo.scale.setScalar(0.26 + 0.14 * tm);
    }
  }
  mats.ledRed.emissiveIntensity = 2.6 + 1.9 * tm;
  mats.ledGreen.emissiveIntensity = 2.6 + 1.9 * tm;

  // gimbal idle
  if (!IS_STATIC && drone.gimbal) {
    drone.gimbal.yaw.rotation.y = Math.sin(t * 0.31) * 0.018;
    drone.gimbal.pivot.rotation.x = 0.018 + Math.sin(t * 0.47 + 1.2) * 0.005;
  }

  controls.update();
  updateHotspots();

  el.coords.textContent = `X ${camera.position.x.toFixed(1)} · Y ${camera.position.y.toFixed(1)} · Z ${camera.position.z.toFixed(1)}`;

  renderer.render(scene, camera);
}

let lights, ground;

function setupLightsRefs(l, tm) {
  if (!l) return;
  l.key.intensity = 3.6 - 2.95 * tm;
  l.fill.intensity = 1.25 - 1.08 * tm;
  l.rim.intensity = 1.9 + 0.75 * tm;
  l.rimR.intensity = 0.7 + 0.55 * tm;
  l.hemi.intensity = 0.55 - 0.42 * tm;
  l.softbox.intensity = 6.0 - 4.8 * tm;
  l.nightRim.intensity = 2.6 * tm;
}

async function boot() {
  const barTimer = setInterval(() => {
    const current = parseFloat(el.loaderBar.style.width) || 0;
    if (current >= 92) return;
    setProgress(Math.min(92, current + 3 + Math.random() * 7));
  }, 110);

  const startAt = performance.now();
  try {
    await init();
    setProgress(100);
    const remain = Math.max(0, 1100 - (performance.now() - startAt));
    await new Promise((r) => setTimeout(r, remain));
    clearInterval(barTimer);
    el.loader.classList.add('is-done');
    document.body.classList.add('is-ready');
    window.__READY__ = true;
  } catch (err) {
    clearInterval(barTimer);
    console.error(err);
    el.loaderPct.textContent = 'ERR';
    const meta = el.loader.querySelector('.loader__meta span');
    if (meta) meta.textContent = '三维引擎初始化失败，请检查 WebGL 支持。';
    window.__ERROR__ = String(err);
    return;
  }

  if (IS_STATIC) {
    document.body.classList.add('is-ready');
    el.loader.classList.add('is-done');
    window.__READY__ = true;
  }
}

// expose a small debug API for the screenshot harness
window.__APP__ = {
  setView: (name, instant = true) => setView(name, { instant }),
  setTheme,
  setRotors,
  setLabels,
  setOrbit,
  getState: () => ({ ...state }),
  scene: () => scene,
  camera: () => camera,
  renderer: () => renderer,
  drone: () => drone,
  textures: () => tex,
  materials: () => mats,
  setCamera: (pos, target) => {
    camera.position.set(pos[0], pos[1], pos[2]);
    controls.target.set(target[0], target[1], target[2]);
    controls.update();
  },
};

boot();
