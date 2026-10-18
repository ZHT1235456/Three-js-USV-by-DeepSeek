import * as THREE from 'three';

/* ------------------------------------------------------------------
   Canvas helpers
------------------------------------------------------------------ */

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, ctx: c.getContext('2d') };
}

function toTexture(canvas, { srgb = true, repeat = 1, anisotropy = 8 } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = anisotropy;
  tex.needsUpdate = true;
  return tex;
}

function seededRandom(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function addFineNoise(ctx, size, amount = 8, alpha = 1, seed = 7) {
  const img = ctx.getImageData(0, 0, size, size);
  const d = img.data;
  const rnd = seededRandom(seed);
  for (let i = 0; i < d.length; i += 4) {
    const n = (rnd() - 0.5) * amount;
    d[i] = Math.max(0, Math.min(255, d[i] + n));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n));
    d[i + 3] = Math.min(255, d[i + 3] * alpha);
  }
  ctx.putImageData(img, 0, 0);
}

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, Math.min(w, h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

/* ------------------------------------------------------------------
   Carbon fibre — 2x2 twill approximation
------------------------------------------------------------------ */

function paintCarbon(ctx, size, cell, { mono = false } = {}) {
  ctx.fillStyle = mono ? '#808080' : '#232428';
  ctx.fillRect(0, 0, size, size);
  const rnd = seededRandom(11);
  const n = Math.round(size / cell);

  for (let iy = 0; iy < n; iy++) {
    for (let ix = 0; ix < n; ix++) {
      const bx = Math.floor(ix / 2);
      const by = Math.floor(iy / 2);
      const horizontal = (bx + by) % 2 === 0;
      const x = ix * cell;
      const y = iy * cell;
      const g = horizontal
        ? ctx.createLinearGradient(x, y, x, y + cell)
        : ctx.createLinearGradient(x, y, x + cell, y);

      if (mono) {
        g.addColorStop(0, '#6e6e6e');
        g.addColorStop(0.22, '#969696');
        g.addColorStop(0.55, '#7e7e7e');
        g.addColorStop(0.82, '#9a9a9a');
        g.addColorStop(1, '#6a6a6a');
      } else {
        g.addColorStop(0, '#1d1e22');
        g.addColorStop(0.2, '#313237');
        g.addColorStop(0.52, '#28292d');
        g.addColorStop(0.8, '#2f3035');
        g.addColorStop(1, '#1e1f23');
      }
      ctx.fillStyle = g;
      ctx.fillRect(x, y, cell, cell);

      // individual tows
      for (let s = 1.5; s < cell; s += 3.2) {
        const a = 0.018 + rnd() * 0.032;
        ctx.strokeStyle = mono
          ? `rgba(255,255,255,${a * 0.8})`
          : `rgba(255,255,255,${a})`;
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        if (horizontal) {
          ctx.moveTo(x, y + s);
          ctx.lineTo(x + cell, y + s);
        } else {
          ctx.moveTo(x + s, y);
          ctx.lineTo(x + s, y + cell);
        }
        ctx.stroke();
      }

      // slight sheen band along the fibre
      const sheen = horizontal
        ? ctx.createLinearGradient(x, y, x, y + cell)
        : ctx.createLinearGradient(x, y, x + cell, y);
      sheen.addColorStop(0, 'rgba(255,255,255,0)');
      sheen.addColorStop(0.35, mono ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.02)');
      sheen.addColorStop(0.6, 'rgba(255,255,255,0)');
      ctx.fillStyle = sheen;
      ctx.fillRect(x, y, cell, cell);

      if (!mono) {
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);
      }
    }
  }

  addFineNoise(ctx, size, mono ? 10 : 6, 1, 3);
}

function makeCarbonMaps(anisotropy) {
  const size = 512;
  const cell = 16;

  const color = makeCanvas(size);
  paintCarbon(color.ctx, size, cell);
  const map = toTexture(color.c, { anisotropy });

  const bump = makeCanvas(size);
  paintCarbon(bump.ctx, size, cell, { mono: true });
  bump.ctx.filter = 'blur(0.4px)';
  bump.ctx.drawImage(bump.c, 0, 0);
  const bumpMap = toTexture(bump.c, { srgb: false, anisotropy });

  const rough = makeCanvas(size);
  rough.ctx.fillStyle = '#7c7c7c';
  rough.ctx.fillRect(0, 0, size, size);
  // broad low-frequency sheen variation
  for (let i = 0; i < 34; i++) {
    const r = 40 + Math.random() * 120;
    const x = Math.random() * size;
    const y = Math.random() * size;
    const g = rough.ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `rgba(255,255,255,${0.02 + Math.random() * 0.04})`);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    rough.ctx.fillStyle = g;
    rough.ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  addFineNoise(rough.ctx, size, 22, 1, 21);
  const roughnessMap = toTexture(rough.c, { srgb: false, anisotropy });

  return { map, bumpMap, roughnessMap };
}

/* ------------------------------------------------------------------
   Graphite / moulded composite surface
------------------------------------------------------------------ */

function makeGraphiteMaps(anisotropy) {
  const size = 512;
  const { c, ctx } = makeCanvas(size);
  ctx.fillStyle = '#e9e9e6';
  ctx.fillRect(0, 0, size, size);

  // low frequency mottling
  const rnd = seededRandom(5);
  for (let i = 0; i < 90; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 30 + rnd() * 150;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() > 0.5 ? 255 : 190;
    g.addColorStop(0, `rgba(${tone},${tone},${tone},${0.025 + rnd() * 0.05})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  // very subtle vertical tooling marks
  ctx.globalAlpha = 0.035;
  for (let x = 0; x < size; x += 3) {
    ctx.fillStyle = rnd() > 0.5 ? '#ffffff' : '#b9b9b9';
    ctx.fillRect(x, 0, 0.7, size);
  }
  ctx.globalAlpha = 1;
  addFineNoise(ctx, size, 12, 1, 9);
  const map = toTexture(c, { anisotropy });

  const { c: rc, ctx: rctx } = makeCanvas(size);
  rctx.fillStyle = '#8f8f8f';
  rctx.fillRect(0, 0, size, size);
  for (let i = 0; i < 45; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 40 + rnd() * 140;
    const g = rctx.createRadialGradient(x, y, 0, x, y, r);
    const tone = rnd() > 0.5 ? 255 : 120;
    g.addColorStop(0, `rgba(${tone},${tone},${tone},0.035)`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    rctx.fillStyle = g;
    rctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
  addFineNoise(rctx, size, 14, 1, 13);
  const roughnessMap = toTexture(rc, { srgb: false, anisotropy });

  const { c: bc, ctx: bctx } = makeCanvas(size);
  bctx.fillStyle = '#808080';
  bctx.fillRect(0, 0, size, size);
  addFineNoise(bctx, size, 34, 1, 17);
  bctx.filter = 'blur(0.3px)';
  bctx.drawImage(bc, 0, 0);
  const bumpMap = toTexture(bc, { srgb: false, anisotropy });

  return { map, roughnessMap, bumpMap };
}

/* ------------------------------------------------------------------
   Decals
------------------------------------------------------------------ */

function drawSpacedText(ctx, text, x, y, spacing) {
  let cursor = x;
  for (const ch of text) {
    ctx.fillText(ch, cursor, y);
    cursor += ctx.measureText(ch).width + spacing;
  }
  return cursor;
}

function measureSpacedText(ctx, text, spacing) {
  let w = 0;
  for (const ch of text) w += ctx.measureText(ch).width + spacing;
  return w - spacing;
}

function makeLogoTexture(anisotropy, color = '#b9bab4') {
  const { c, ctx } = makeCanvas(512);
  const cx = 256;
  const cy = 266;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  // rounded triangular ring
  const p = [
    [cx, 104],
    [cx + 152, 388],
    [cx - 152, 388],
  ];
  ctx.lineWidth = 11;
  ctx.beginPath();
  const r = 26;
  for (let i = 0; i < 3; i++) {
    const a = p[i];
    const b = p[(i + 1) % 3];
    if (i === 0) ctx.moveTo(a[0] + (b[0] - a[0]) * 0.16, a[1] + (b[1] - a[1]) * 0.16);
    ctx.arcTo(b[0], b[1], p[(i + 2) % 3][0], p[(i + 2) % 3][1], r);
  }
  ctx.closePath();
  ctx.stroke();

  // three-blade emblem
  const blade = (angle) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.bezierCurveTo(12, -46, 30, -82, 58, -96);
    ctx.bezierCurveTo(46, -56, 30, -28, 8, -4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  };
  blade(0);
  blade((Math.PI * 2) / 3);
  blade((Math.PI * 4) / 3);

  // centre hub
  ctx.beginPath();
  ctx.arc(cx, cy, 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'destination-out';
  ctx.beginPath();
  ctx.arc(cx, cy, 9, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  // hairline highlights
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(cx, cy, 21, Math.PI * 1.05, Math.PI * 1.75);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const tex = toTexture(c, { anisotropy, repeat: 1 });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makePowerTexture(anisotropy) {
  const { c, ctx } = makeCanvas(256);
  ctx.strokeStyle = '#c9cac4';
  ctx.lineWidth = 13;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(128, 138, 66, -Math.PI * 0.32, Math.PI * 1.32);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(128, 46);
  ctx.lineTo(128, 128);
  ctx.stroke();
  const tex = toTexture(c, { anisotropy });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeSkyproTexture(anisotropy, font = 'Manrope') {
  const { c, ctx } = makeCanvas(1024, 256);
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c9cac4';

  ctx.font = `600 124px "${font}", sans-serif`;
  const spacing = 13;
  const w1 = measureSpacedText(ctx, 'SKYPRO', spacing);
  const wGap = 30;
  ctx.font = `500 124px "${font}", sans-serif`;
  const w2 = measureSpacedText(ctx, 'XT', spacing);
  const total = w1 + wGap + w2;
  let x = (1024 - total) / 2;
  const y = 138;
  ctx.font = `600 124px "${font}", sans-serif`;
  drawSpacedText(ctx, 'SKYPRO', x, y, spacing);
  x += w1 + wGap;
  ctx.font = `400 124px "${font}", sans-serif`;
  ctx.globalAlpha = 0.82;
  drawSpacedText(ctx, 'XT', x, y, spacing);
  ctx.globalAlpha = 1;

  // small machined underline
  ctx.fillStyle = 'rgba(201,202,196,0.35)';
  ctx.fillRect(1024 * 0.16, 214, 1024 * 0.68, 3);

  const tex = toTexture(c, { anisotropy });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeVentTexture(anisotropy) {
  const { c, ctx } = makeCanvas(256, 128);

  ctx.save();
  roundedRect(ctx, 2, 2, 252, 124, 16);
  ctx.clip();
  const g = ctx.createLinearGradient(0, 0, 0, 128);
  g.addColorStop(0, '#17181b');
  g.addColorStop(1, '#0b0c0e');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 128);

  // diagonal vanes
  for (let x = -24; x < 280; x += 26) {
    ctx.beginPath();
    ctx.moveTo(x, 10);
    ctx.lineTo(x + 58, 118);
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#2c2d31';
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 3, 10);
    ctx.lineTo(x + 61, 118);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(180,182,180,0.26)';
    ctx.stroke();
  }
  // dark inner shadow on the top edge
  const sh = ctx.createLinearGradient(0, 0, 0, 34);
  sh.addColorStop(0, 'rgba(0,0,0,0.8)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, 256, 34);
  ctx.restore();

  ctx.strokeStyle = 'rgba(150,152,150,0.25)';
  ctx.lineWidth = 2;
  roundedRect(ctx, 3, 3, 250, 122, 15);
  ctx.stroke();

  const tex = toTexture(c, { anisotropy });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeGlowTexture() {
  const { c, ctx } = makeCanvas(256);
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.55)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.18)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.04)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makePropBlurTexture(anisotropy) {
  const { c, ctx } = makeCanvas(1024);
  const cx = 512;
  const cy = 512;
  const R = 486;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.clip();

  // faint disc
  const disc = ctx.createRadialGradient(cx, cy, 20, cx, cy, R);
  disc.addColorStop(0, 'rgba(210,212,214,0.012)');
  disc.addColorStop(0.55, 'rgba(210,212,214,0.03)');
  disc.addColorStop(0.94, 'rgba(225,227,228,0.10)');
  disc.addColorStop(1, 'rgba(225,227,228,0.0)');
  ctx.fillStyle = disc;
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.filter = 'blur(9px)';
  for (let k = 0; k < 3; k++) {
    const base = (k * Math.PI * 2) / 3;
    for (let f = 0; f < 4; f++) {
      const a0 = base + (f / 4) * Math.PI * 0.55;
      const a1 = a0 + Math.PI * 0.5;
      const grad = ctx.createRadialGradient(cx, cy, 70, cx, cy, R);
      grad.addColorStop(0, 'rgba(20,21,23,0.0)');
      grad.addColorStop(0.28, 'rgba(26,27,30,0.20)');
      grad.addColorStop(0.72, 'rgba(32,33,36,0.26)');
      grad.addColorStop(0.97, 'rgba(45,46,50,0.20)');
      grad.addColorStop(1, 'rgba(45,46,50,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, R, a0, a1);
      const thickness = 66 + 12 * Math.sin(f * 2.1);
      ctx.arc(cx, cy, R - thickness, a1, a0, true);
      ctx.closePath();
      ctx.fill();
    }
  }
  ctx.filter = 'none';

  // silver tip arc
  ctx.filter = 'blur(5px)';
  for (let k = 0; k < 3; k++) {
    const a0 = (k * Math.PI * 2) / 3 + 0.12;
    const grad = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R);
    grad.addColorStop(0, 'rgba(200,201,196,0)');
    grad.addColorStop(0.75, 'rgba(210,211,206,0.12)');
    grad.addColorStop(1, 'rgba(210,211,206,0)');
    ctx.strokeStyle = grad;
    ctx.lineWidth = 26;
    ctx.beginPath();
    ctx.arc(cx, cy, R - 20, a0, a0 + Math.PI * 0.55);
    ctx.stroke();
  }
  ctx.filter = 'none';
  ctx.restore();

  const tex = toTexture(c, { anisotropy });
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  return tex;
}

function makeContactShadowTexture() {
  const { c, ctx } = makeCanvas(512);
  const g = ctx.createRadialGradient(256, 256, 10, 256, 256, 250);
  g.addColorStop(0, 'rgba(0,0,0,0.62)');
  g.addColorStop(0.3, 'rgba(0,0,0,0.34)');
  g.addColorStop(0.62, 'rgba(0,0,0,0.10)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 512, 512);
  return new THREE.CanvasTexture(c);
}

function makeLensGlintTexture() {
  const { c, ctx } = makeCanvas(256);
  ctx.clearRect(0, 0, 256, 256);
  const g = ctx.createRadialGradient(96, 90, 2, 96, 90, 70);
  g.addColorStop(0, 'rgba(225,255,238,0.9)');
  g.addColorStop(0.2, 'rgba(170,240,205,0.35)');
  g.addColorStop(0.55, 'rgba(120,200,160,0.06)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------
   Export
------------------------------------------------------------------ */

export async function createTextures(renderer) {
  const anis = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  await document.fonts.ready;

  return {
    carbon: makeCarbonMaps(anis),
    graphite: makeGraphiteMaps(anis),
    logo: makeLogoTexture(anis),
    logoDark: makeLogoTexture(anis, '#55575a'),
    power: makePowerTexture(anis),
    skypro: makeSkyproTexture(anis),
    vent: makeVentTexture(anis),
    glow: makeGlowTexture(),
    propBlur: makePropBlurTexture(anis),
    contactShadow: makeContactShadowTexture(),
    lensGlint: makeLensGlintTexture(),
  };
}
