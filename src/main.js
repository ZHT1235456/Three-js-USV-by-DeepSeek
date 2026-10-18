import '@fontsource-variable/fraunces/wght.css';
import '@fontsource-variable/fraunces/wght-italic.css';
import '@fontsource-variable/familjen-grotesk/wght.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './styles.css';

import * as THREE from 'three';
import { createStage } from './stage.js';
import { createMaterials } from './materials.js';
import { createBoat } from './boat.js';
import {
  makeTeakTexture,
  makeCarbonTexture,
  makeSolarTexture,
  makeHullNameTexture,
  makeTransomTexture,
  makePlotterTexture
} from './textures.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutQuint = (t) => 1 - Math.pow(1 - t, 5);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));

const dom = {
  sceneRoot: document.querySelector('#scene-root'),
  loader: document.querySelector('#loader'),
  loaderBar: document.querySelector('#loader-bar'),
  loaderPercent: document.querySelector('#loader-percent'),
  hotspotLayer: document.querySelector('#hotspots'),
  orbitButton: document.querySelector('#orbit-button'),
  resetButton: document.querySelector('#reset-button'),
  detailPanel: document.querySelector('#detail-panel'),
  detailKicker: document.querySelector('#detail-kicker'),
  detailTitle: document.querySelector('#detail-title'),
  detailCopy: document.querySelector('#detail-copy'),
  detailSpecs: document.querySelector('#detail-specs'),
  detailClose: document.querySelector('#detail-close'),
  azimuth: document.querySelector('#azimuth'),
  brand: document.querySelector('.brand'),
  viewButtons: [...document.querySelectorAll('.view-button')]
};

let stage = null;
let boat = null;
let materials = null;
let autoOrbit = false;
let activeHotspot = null;
let cameraTween = null;
let hotspotElements = [];
let lastAzimuthUpdate = 0;
let introStarted = false;
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const views = {
  hero: {
    theta: -0.64,
    phi: 1.385,
    radius: 13.05,
    target: [0, 0.99, 0.08],
    mobileScale: 1.42
  },
  bow: {
    theta: -0.27,
    phi: 1.43,
    radius: 8.6,
    target: [0, 1.0, 2.3],
    mobileScale: 1.0
  },
  beam: {
    theta: -Math.PI / 2 - 0.025,
    phi: 1.425,
    radius: 12.5,
    target: [0, 0.98, 0.0],
    mobileScale: 1.95
  },
  aerial: {
    theta: -0.57,
    phi: 0.7,
    radius: 15.5,
    target: [0, 0.6, 0.2],
    mobileScale: 1.22
  }
};

const intro = {
  theta: -0.93,
  phi: 1.17,
  radius: 15.2,
  target: [0, 1.18, 0.12]
};

function setProgress(value) {
  const amount = clamp(Math.round(value), 0, 100);
  dom.loaderBar.style.width = amount + '%';
  dom.loaderPercent.textContent = String(amount).padStart(2, '0');
}

function getAspect() {
  return window.innerWidth / window.innerHeight;
}

function cameraLens() {
  const aspect = getAspect();
  if (aspect < 0.7) return { fov: 49, radiusScale: 1.48 };
  if (aspect < 1.0) return { fov: 44, radiusScale: 1.28 };
  if (aspect < 1.32) return { fov: 37, radiusScale: 1.12 };
  if (aspect < 1.5) return { fov: 34, radiusScale: 1.04 };
  return { fov: 33, radiusScale: 1.0 };
}

function applyLens() {
  if (!stage) return;
  const lens = cameraLens();
  stage.camera.fov = lens.fov;
  stage.camera.updateProjectionMatrix();
  stage.controls.maxDistance = getAspect() < 0.9 ? 31 : 21;
}

function resolvePreset(preset) {
  const lens = cameraLens();
  const target = new THREE.Vector3(
    preset.target[0],
    preset.target[1],
    preset.target[2]
  );
  const portrait = getAspect() < 0.9;
  const radiusScale = portrait && preset.mobileScale !== undefined ? preset.mobileScale : lens.radiusScale;
  const radius = preset.radius * radiusScale;
  const sinPhi = Math.sin(preset.phi);
  const position = new THREE.Vector3(
    target.x + radius * sinPhi * Math.sin(preset.theta),
    target.y + radius * Math.cos(preset.phi),
    target.z + radius * sinPhi * Math.cos(preset.theta)
  );
  return { position, target };
}

function setCameraInstant(preset) {
  cameraTween = null;
  if (stage) stage.controls.enabled = true;
  const resolved = resolvePreset(preset);
  stage.camera.position.copy(resolved.position);
  stage.controls.target.copy(resolved.target);
  stage.camera.lookAt(resolved.target);
}

function moveCamera(preset, duration = 1.55, easing = easeInOutCubic) {
  if (!stage) return;
  if (reducedMotion) {
    setCameraInstant(preset);
    return;
  }
  const resolved = resolvePreset(preset);
  const now = performance.now();
  cameraTween = {
    start: now,
    duration: duration * 1000,
    fromPosition: stage.camera.position.clone(),
    fromTarget: stage.controls.target.clone(),
    toPosition: resolved.position,
    toTarget: resolved.target,
    easing
  };
  stage.controls.enabled = false;
}

function updateCameraTween(now) {
  if (!cameraTween || !stage) return false;
  const t = clamp((now - cameraTween.start) / cameraTween.duration, 0, 1);
  const e = cameraTween.easing(t);
  stage.camera.position.lerpVectors(cameraTween.fromPosition, cameraTween.toPosition, e);
  stage.controls.target.lerpVectors(cameraTween.fromTarget, cameraTween.toTarget, e);
  stage.camera.lookAt(stage.controls.target);
  if (t >= 1) {
    stage.controls.enabled = true;
    cameraTween = null;
  }
  return true;
}

function setAutoOrbit(value) {
  autoOrbit = value;
  if (stage) stage.controls.autoRotate = value;
  dom.orbitButton.setAttribute('aria-pressed', String(value));
  dom.orbitButton.querySelector('span:not(.toggle-dot)').textContent = value ? 'Orbiting' : 'Orbit';
}

function setAlternativeView(value) {
  document.body.classList.toggle('is-alt-view', value);
}

function clearViewSelection() {
  dom.viewButtons.forEach((button) => {
    button.classList.remove('is-active');
    button.setAttribute('aria-pressed', 'false');
  });
}

function selectViewButton(name) {
  dom.viewButtons.forEach((button) => {
    const isActive = button.dataset.view === name;
    button.classList.toggle('is-active', isActive);
    button.setAttribute('aria-pressed', String(isActive));
  });
}

function closeDetail() {
  document.body.classList.remove('is-inspecting');
  dom.detailPanel.classList.remove('is-open');
  dom.detailPanel.setAttribute('aria-hidden', 'true');
  dom.detailPanel.inert = true;
  if (!activeHotspot) return;
  activeHotspot = null;
  hotspotElements.forEach(({ element }) => element.classList.remove('is-active'));
}

function openDetail(hotspot) {
  if (!hotspot) return;
  activeHotspot = hotspot;
  document.body.classList.add('is-inspecting');
  dom.detailPanel.inert = false;
  dom.detailKicker.textContent = hotspot.kicker;
  dom.detailTitle.textContent = hotspot.title;
  dom.detailCopy.textContent = hotspot.copy;
  dom.detailSpecs.innerHTML = '';
  hotspot.specs.forEach(([label, value]) => {
    const item = document.createElement('div');
    const labelEl = document.createElement('span');
    const valueEl = document.createElement('strong');
    labelEl.textContent = label;
    valueEl.textContent = value;
    item.append(labelEl, valueEl);
    dom.detailSpecs.appendChild(item);
  });
  dom.detailPanel.classList.add('is-open');
  dom.detailPanel.setAttribute('aria-hidden', 'false');
  clearViewSelection();
  hotspotElements.forEach(({ element, data }) => {
    element.classList.toggle('is-active', data.id === hotspot.id);
  });
  setAutoOrbit(false);
  moveCamera(hotspot.focus, 1.75);
}

function buildHotspots() {
  hotspotElements = boat.hotspots.map((hotspot) => {
    const element = document.createElement('button');
    element.type = 'button';
    element.className = 'hotspot';
    element.setAttribute('aria-label', hotspot.number + ' — ' + hotspot.label + ': ' + hotspot.title);
    element.innerHTML =
      '<span class="hotspot-index">' + hotspot.number + '</span>' +
      '<span class="hotspot-dot" aria-hidden="true"></span>' +
      '<span class="hotspot-tag">' + hotspot.label + '</span>';
    element.addEventListener('click', (event) => {
      event.stopPropagation();
      if (activeHotspot && activeHotspot.id === hotspot.id) {
        closeDetail();
      } else {
        openDetail(hotspot);
      }
    });
    dom.hotspotLayer.appendChild(element);
    return { element, data: hotspot, anchor: hotspot.anchor };
  });
}

const projected = new THREE.Vector3();
function updateHotspots() {
  if (!stage) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  hotspotElements.forEach(({ element, anchor }) => {
    anchor.getWorldPosition(projected);
    projected.project(stage.camera);
    const inFront = projected.z > -1 && projected.z < 1;
    const x = (projected.x * 0.5 + 0.5) * width;
    const y = (-projected.y * 0.5 + 0.5) * height;
    const visible = inFront && x > -40 && x < width + 40 && y > -40 && y < height + 40;
    element.classList.toggle('is-visible', visible);
    if (visible) {
      element.style.transform = 'translate3d(' + (x - 10).toFixed(1) + 'px, ' + (y - 10).toFixed(1) + 'px, 0)';
      // Flip the label if it would run off the right side of the viewport.
      element.classList.toggle('tag-left', x > width - 190);
    }
  });
}

function updateAzimuth(now) {
  if (!stage || now - lastAzimuthUpdate < 90) return;
  lastAzimuthUpdate = now;
  const dx = stage.camera.position.x - stage.controls.target.x;
  const dz = stage.camera.position.z - stage.controls.target.z;
  const degrees = (Math.atan2(dx, dz) * 180 / Math.PI + 360) % 360;
  dom.azimuth.textContent = degrees.toFixed(1).padStart(5, '0') + '°';
}

function setupUI() {
  buildHotspots();

  dom.orbitButton.addEventListener('click', () => {
    setAutoOrbit(!autoOrbit);
  });

  dom.resetButton.addEventListener('click', () => {
    setAutoOrbit(false);
    closeDetail();
    setAlternativeView(false);
    clearViewSelection();
    dom.viewButtons[0].classList.add('is-active');
    dom.viewButtons[0].setAttribute('aria-pressed', 'true');
    moveCamera(views.hero, 1.55);
  });

  dom.viewButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const name = button.dataset.view;
      setAutoOrbit(false);
      closeDetail();
      setAlternativeView(name !== 'hero');
      selectViewButton(name);
      moveCamera(views[name] || views.hero, 1.65);
    });
  });

  dom.detailClose.addEventListener('click', closeDetail);

  dom.brand.addEventListener('click', (event) => {
    event.preventDefault();
    dom.resetButton.click();
  });

  window.addEventListener('keydown', (event) => {
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.key === 'Escape') {
      closeDetail();
      return;
    }
    if (event.key === 'o' || event.key === 'O') {
      setAutoOrbit(!autoOrbit);
      return;
    }
    const keyMap = { '1': 'hero', '2': 'bow', '3': 'beam', '4': 'aerial' };
    if (keyMap[event.key]) {
      setAutoOrbit(false);
      closeDetail();
      setAlternativeView(keyMap[event.key] !== 'hero');
      selectViewButton(keyMap[event.key]);
      moveCamera(views[keyMap[event.key]], 1.5);
    }
  });

  stage.renderer.domElement.addEventListener('pointerdown', () => {
    if (autoOrbit) setAutoOrbit(false);
  });

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      stage.resize();
      applyLens();
    }, 80);
  });
}

async function init() {
  try {
    setProgress(4);
    await nextFrame();

    try {
      await Promise.all([
        document.fonts.load('300 100px "Fraunces Variable"'),
        document.fonts.load('italic 300 100px "Fraunces Variable"'),
        document.fonts.load('500 92px "Familjen Grotesk Variable"'),
        document.fonts.load('400 12px "IBM Plex Mono"')
      ]);
      await document.fonts.ready;
    } catch (fontError) {
      console.warn('Font loading did not complete; using fallbacks.', fontError);
    }

    setProgress(12);
    await nextFrame();

    stage = createStage({ container: dom.sceneRoot });
    applyLens();
    setCameraInstant(intro);
    setProgress(38);
    await nextFrame();

    const renderer = stage.renderer;
    const textures = {
      teak: makeTeakTexture(renderer),
      carbon: makeCarbonTexture(renderer),
      solar: makeSolarTexture(renderer),
      hullName: makeHullNameTexture(renderer),
      transomName: makeTransomTexture(renderer),
      plotter: makePlotterTexture(renderer)
    };
    setProgress(56);
    await nextFrame();

    materials = createMaterials(textures);
    boat = createBoat({ renderer, materials });
    stage.scene.add(boat.group);
    setProgress(78);
    await nextFrame();

    setupUI();
    if (import.meta.env.DEV) {
      window.__c7 = { stage, boat, materials, views, setCameraInstant, moveCamera, resolvePreset, setAutoOrbit, openDetail, closeDetail };
    }
    setProgress(91);
    stage.update(0, 0);
    stage.render();
    await nextFrame();
    setProgress(100);
    await wait(420);
    dom.loader.classList.add('is-hidden');
    document.body.classList.add('is-ready');
    if (reducedMotion) {
      setCameraInstant(views.hero);
    } else {
      window.setTimeout(() => {
        if (!introStarted) {
          introStarted = true;
          moveCamera(views.hero, 2.7, easeOutQuint);
        }
      }, 250);
    }

    let last = performance.now();
    function animate(now) {
      requestAnimationFrame(animate);
      const delta = Math.min((now - last) / 1000, 0.05);
      last = now;
      const time = reducedMotion ? 0 : now / 1000;
      const tweenActive = updateCameraTween(now);
      if (!tweenActive) stage.controls.update();
      stage.update(time, reducedMotion ? 0 : delta);
      boat.update(time, reducedMotion ? 0 : delta);
      updateHotspots();
      updateAzimuth(now);
      stage.render();
    }
    requestAnimationFrame(animate);
  } catch (error) {
    console.error(error);
    const copy = document.querySelector('.loader-copy span');
    if (copy) copy.textContent = 'SIGNAL INTERRUPTED';
    const meta = document.querySelector('.loader-meta');
    if (meta) meta.innerHTML = '<span>WEBGL / UNAVAILABLE</span><span>REFRESH TO RETRY</span>';
    if (dom.loaderBar) dom.loaderBar.style.width = '100%';
    if (dom.loaderPercent) dom.loaderPercent.textContent = '--';
  }
}

init();
