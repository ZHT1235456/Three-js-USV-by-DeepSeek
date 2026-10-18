import * as THREE from 'three';

const FONT_SANS = '"Familjen Grotesk Variable", "Helvetica Neue", sans-serif';
const FONT_MONO = '"IBM Plex Mono", "Courier New", monospace';

function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function canvasTexture(canvas, anisotropy = 8, colorSpace = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = anisotropy;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  if (colorSpace) texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export function makeTeakTexture(renderer) {
  const anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const w = 2048;
  const h = 1024;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(127);

  ctx.fillStyle = '#d8d2c5';
  ctx.fillRect(0, 0, w, h);

  // Fine, directional grain in the pale margin.
  for (let i = 0; i < 500; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.strokeStyle = 'rgba(82, 79, 68, ' + (0.012 + rand() * 0.028) + ')';
    ctx.lineWidth = 0.5 + rand();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 12 + rand() * 80, y + (rand() - 0.5) * 2);
    ctx.stroke();
  }

  const margin = w * 0.048;
  const innerX = margin;
  const innerW = w - margin * 2;
  const plankCount = 29;
  const plankW = innerW / plankCount;

  ctx.fillStyle = '#0d1513';
  ctx.fillRect(innerX, 0, innerW, h);

  for (let p = 0; p < plankCount; p++) {
    const x = innerX + p * plankW;
    const tone = 0.88 + rand() * 0.19;
    const r = Math.round(157 * tone);
    const g = Math.round(117 * tone);
    const b = Math.round(75 * tone);
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(x + 2.3, 0, plankW - 4.6, h);

    // Long grain filaments, brighter on the light-catching edge.
    for (let i = 0; i < 30; i++) {
      const gx = x + 5 + rand() * (plankW - 10);
      const gy = rand() * h;
      const len = 60 + rand() * 340;
      const alpha = 0.025 + rand() * 0.075;
      ctx.strokeStyle = rand() > 0.44
        ? `rgba(236, 202, 153, ${alpha})`
        : `rgba(67, 43, 25, ${alpha})`;
      ctx.lineWidth = 0.45 + rand() * 1.25;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.bezierCurveTo(gx + (rand() - 0.5) * 5, gy + len * 0.32, gx + (rand() - 0.5) * 6, gy + len * 0.7, gx + (rand() - 0.5) * 8, gy + len);
      ctx.stroke();
    }

    // Plank butt joints.
    const joints = 2 + Math.floor(rand() * 2);
    for (let j = 0; j < joints; j++) {
      const jy = ((j + rand() * 0.65) / joints) * h;
      ctx.fillStyle = 'rgba(13, 21, 19, 0.58)';
      ctx.fillRect(x + 2.3, jy, plankW - 4.6, 2.4);
      ctx.fillStyle = 'rgba(255, 236, 202, 0.11)';
      ctx.fillRect(x + 2.3, jy + 2.4, plankW - 4.6, 1);
    }

    // Subtle edge catch.
    const grad = ctx.createLinearGradient(x, 0, x + plankW, 0);
    grad.addColorStop(0, 'rgba(255, 226, 178, 0.1)');
    grad.addColorStop(0.38, 'rgba(255, 255, 255, 0)');
    grad.addColorStop(1, 'rgba(50, 31, 18, 0.09)');
    ctx.fillStyle = grad;
    ctx.fillRect(x + 2.3, 0, plankW - 4.6, h);
  }

  // Caulk chamfers around the perimeter.
  ctx.fillStyle = 'rgba(8, 13, 12, 0.7)';
  ctx.fillRect(innerX - 3, 0, 3, h);
  ctx.fillRect(innerX + innerW, 0, 3, h);
  ctx.fillStyle = 'rgba(255, 247, 227, 0.26)';
  ctx.fillRect(innerX - 5, 0, 1.2, h);
  ctx.fillRect(innerX + innerW + 3.8, 0, 1.2, h);

  // Micro speckle and salt bloom.
  for (let i = 0; i < 2400; i++) {
    const x = rand() * w;
    const y = rand() * h;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(245, 236, 215, 0.035)' : 'rgba(40, 31, 20, 0.03)';
    ctx.fillRect(x, y, 0.7 + rand() * 1.4, 0.7 + rand() * 1.4);
  }

  const texture = canvasTexture(canvas, anisotropy);
  return texture;
}

export function makeCarbonTexture(renderer) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const size = 512;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const rand = seededRandom(88);

  ctx.fillStyle = '#101515';
  ctx.fillRect(0, 0, size, size);

  const step = 32;
  for (let y = -step; y < size + step; y += step) {
    for (let x = -step; x < size + step; x += step) {
      const shift = (Math.floor(y / step) % 2) * (step / 2);
      const px = x + shift;
      const dark = (Math.floor(x / step) + Math.floor(y / step)) % 2 === 0;
      ctx.fillStyle = dark ? '#171d1d' : '#202726';
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + step, y);
      ctx.lineTo(px + step - step, y + step);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = dark ? 'rgba(141, 171, 167, 0.08)' : 'rgba(141, 171, 167, 0.035)';
      ctx.beginPath();
      ctx.moveTo(px, y);
      ctx.lineTo(px + step * 0.45, y);
      ctx.lineTo(px + step * 0.45 - step, y + step * 0.7);
      ctx.closePath();
      ctx.fill();
    }
  }

  for (let i = 0; i < 5500; i++) {
    const x = rand() * size;
    const y = rand() * size;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.018)' : 'rgba(0,0,0,0.035)';
    ctx.fillRect(x, y, 0.7, 0.7);
  }

  const texture = canvasTexture(canvas, anisotropy);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function makeSolarTexture(renderer) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#070d11';
  ctx.fillRect(0, 0, w, h);

  const frame = 12;
  const cols = 8;
  const rows = 4;
  const gap = 7;
  const cellW = (w - frame * 2 - gap * (cols - 1)) / cols;
  const cellH = (h - frame * 2 - gap * (rows - 1)) / rows;

  const sheen = ctx.createLinearGradient(0, 0, w, h);
  sheen.addColorStop(0, 'rgba(110, 160, 172, 0.29)');
  sheen.addColorStop(0.24, 'rgba(17, 40, 52, 0.08)');
  sheen.addColorStop(0.6, 'rgba(3, 8, 14, 0.12)');
  sheen.addColorStop(1, 'rgba(94, 140, 153, 0.14)');

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = frame + c * (cellW + gap);
      const y = frame + r * (cellH + gap);
      const base = ctx.createLinearGradient(x, y, x + cellW, y + cellH);
      base.addColorStop(0, '#0d1c27');
      base.addColorStop(0.45, '#0a1721');
      base.addColorStop(1, '#071018');
      ctx.fillStyle = base;
      ctx.fillRect(x, y, cellW, cellH);
      ctx.fillStyle = sheen;
      ctx.fillRect(x, y, cellW, cellH);

      ctx.strokeStyle = 'rgba(185, 208, 208, 0.28)';
      ctx.lineWidth = 1.8;
      ctx.strokeRect(x, y, cellW, cellH);

      // Fingers.
      ctx.strokeStyle = 'rgba(196, 215, 213, 0.16)';
      ctx.lineWidth = 1;
      for (let f = 1; f < 3; f++) {
        const fx = x + (cellW / 3) * f;
        ctx.beginPath();
        ctx.moveTo(fx, y + 6);
        ctx.lineTo(fx, y + cellH - 6);
        ctx.stroke();
      }
    }
  }

  ctx.strokeStyle = 'rgba(195, 208, 202, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  return canvasTexture(canvas, anisotropy);
}

export function makeHullNameTexture(renderer) {
  const anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const canvas = document.createElement('canvas');
  canvas.width = 1280;
  canvas.height = 300;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1280, 300);

  ctx.fillStyle = '#122320';
  ctx.font = `500 92px ${FONT_SANS}`;
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '17px';
  ctx.fillText('CORMORANT', 46, 122);

  ctx.fillStyle = '#c85c3c';
  ctx.fillRect(48, 189, 23, 2.5);

  ctx.fillStyle = 'rgba(18, 35, 32, 0.72)';
  ctx.font = `400 20px ${FONT_MONO}`;
  ctx.letterSpacing = '7px';
  ctx.fillText('C–07   /   COASTAL SURVEY', 88, 194);

  ctx.fillStyle = '#c85c3c';
  ctx.font = '400 18px ' + FONT_MONO;
  ctx.letterSpacing = '3px';
  ctx.textAlign = 'right';
  ctx.fillText('PELAGIC', 1232, 78);

  ctx.strokeStyle = 'rgba(18, 35, 32, 0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(46, 227);
  ctx.lineTo(1232, 227);
  ctx.stroke();

  return canvasTexture(canvas, anisotropy);
}

export function makeTransomTexture(renderer) {
  const anisotropy = Math.min(16, renderer.capabilities.getMaxAnisotropy());
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 360;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 360);

  ctx.textAlign = 'center';
  ctx.fillStyle = '#132320';
  ctx.font = `500 58px ${FONT_SANS}`;
  ctx.letterSpacing = '14px';
  ctx.fillText('CORMORANT', 512, 146);

  ctx.fillStyle = 'rgba(19, 35, 32, 0.66)';
  ctx.font = `400 17px ${FONT_MONO}`;
  ctx.letterSpacing = '8px';
  ctx.fillText('C–07  ·  COASTAL SURVEY', 512, 196);

  ctx.strokeStyle = '#c85c3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(416, 224);
  ctx.lineTo(608, 224);
  ctx.stroke();

  ctx.fillStyle = 'rgba(19, 35, 32, 0.54)';
  ctx.font = `400 12px ${FONT_MONO}`;
  ctx.letterSpacing = '4px';
  ctx.fillText('PELAGIC MARINE SYSTEMS  /  SAN DIEGO', 512, 258);

  return canvasTexture(canvas, anisotropy);
}

export function makePlotterTexture(renderer) {
  const anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const w = 512;
  const h = 320;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#03100f';
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = 'rgba(115, 187, 170, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= w; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, h);
    ctx.stroke();
  }
  for (let y = 0; y <= h; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(w, y);
    ctx.stroke();
  }

  // Coastline-like contour.
  ctx.strokeStyle = 'rgba(127, 207, 185, 0.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 218);
  ctx.bezierCurveTo(110, 156, 164, 248, 226, 190);
  ctx.bezierCurveTo(290, 126, 344, 188, 430, 112);
  ctx.stroke();

  ctx.strokeStyle = 'rgba(127, 207, 185, 0.22)';
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(30, 218 + i * 21);
    ctx.bezierCurveTo(110, 156 + i * 21, 164, 248 + i * 21, 226, 190 + i * 21);
    ctx.bezierCurveTo(290, 126 + i * 21, 344, 188 + i * 21, 430, 112 + i * 21);
    ctx.stroke();
  }

  ctx.strokeStyle = '#e26543';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(86, 230);
  ctx.lineTo(154, 172);
  ctx.lineTo(254, 190);
  ctx.lineTo(358, 138);
  ctx.stroke();
  ctx.fillStyle = '#f5e9d3';
  ctx.beginPath();
  ctx.arc(358, 138, 4.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(199, 222, 212, 0.75)';
  ctx.font = `400 12px ${FONT_MONO}`;
  ctx.letterSpacing = '2px';
  ctx.fillText('AUTONOMY / 07', 24, 30);
  ctx.fillText('SECTOR B–12', 24, 49);
  ctx.fillStyle = '#e26543';
  ctx.fillText('ROUTE ACTIVE', 382, 30);

  return canvasTexture(canvas, anisotropy);
}

export function makeParticleTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(198, 224, 214, 0.55)');
  grad.addColorStop(0.25, 'rgba(189, 218, 207, 0.2)');
  grad.addColorStop(0.58, 'rgba(170, 204, 193, 0.06)');
  grad.addColorStop(1, 'rgba(160, 190, 180, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export function makeSoftShadowTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 512, 1024);
  ctx.save();
  ctx.translate(256, 512);
  ctx.scale(0.48, 1);
  const gradient = ctx.createRadialGradient(0, 0, 8, 0, 0, 500);
  gradient.addColorStop(0, 'rgba(0, 6, 5, 0.66)');
  gradient.addColorStop(0.35, 'rgba(0, 6, 5, 0.36)');
  gradient.addColorStop(0.7, 'rgba(0, 6, 5, 0.09)');
  gradient.addColorStop(1, 'rgba(0, 6, 5, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(0, 0, 510, 500, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}
