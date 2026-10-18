import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { makeParticleTexture } from './textures.js';

const OceanShader = {
  name: 'CormorantOcean',
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uDeepColor: { value: new THREE.Color(0x010909) },
    uShallowColor: { value: new THREE.Color(0x072522) },
    uFogColor: { value: new THREE.Color(0x061614) },
    uSunColor: { value: new THREE.Color(0xb27b54) },
    uSunDirection: { value: new THREE.Vector3(0.52, 0.17, -0.78).normalize() },
    uReflectionTint: { value: new THREE.Vector3(0.66, 0.87, 0.83) }
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vViewDirection;

    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vUv = textureMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      vViewDirection = cameraPosition - worldPosition.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPosition;
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec3 uDeepColor;
    uniform vec3 uShallowColor;
    uniform vec3 uFogColor;
    uniform vec3 uSunColor;
    uniform vec3 uSunDirection;
    uniform vec3 uReflectionTint;
    varying vec4 vUv;
    varying vec3 vWorldPosition;
    varying vec3 vViewDirection;

    float hash21(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float valueNoise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      float a = hash21(i);
      float b = hash21(i + vec2(1.0, 0.0));
      float c = hash21(i + vec2(0.0, 1.0));
      float d = hash21(i + vec2(1.0, 1.0));
      return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
    }

    void main() {
      vec2 p = vWorldPosition.xz;
      float t = uTime;
      vec3 viewDirection = normalize(vViewDirection);

      // Layered analytic wave slopes. The amplitudes are intentionally quiet.
      float low = sin(p.x * 0.52 + t * 0.27) * cos(p.y * 0.43 - t * 0.19);
      float mid = sin(p.x * 1.31 + p.y * 0.96 - t * 0.63 + 1.2);
      float fine = sin(p.x * 3.7 - p.y * 3.1 + t * 1.15) * 0.55
                 + sin(p.x * 7.9 + p.y * 5.4 - t * 2.2) * 0.22;

      vec2 slope;
      slope.x = cos(p.x * 0.52 + t * 0.27) * 0.52 * cos(p.y * 0.43 - t * 0.19)
              + cos(p.x * 1.31 + p.y * 0.96 - t * 0.63 + 1.2) * 0.50
              + cos(p.x * 3.7 - p.y * 3.1 + t * 1.15) * 0.075
              + cos(p.x * 7.9 + p.y * 5.4 - t * 2.2) * 0.055;
      slope.y = -sin(p.x * 0.52 + t * 0.27) * sin(p.y * 0.43 - t * 0.19) * 0.43
              + cos(p.x * 1.31 + p.y * 0.96 - t * 0.63 + 1.2) * 0.37
              - cos(p.x * 3.7 - p.y * 3.1 + t * 1.15) * 0.065
              + cos(p.x * 7.9 + p.y * 5.4 - t * 2.2) * 0.047;

      vec3 normal = normalize(vec3(slope.x * 0.035, 1.0, slope.y * 0.035));

      vec4 reflectionUv = vUv;
      reflectionUv.xy += normal.xz * reflectionUv.w * 0.028;
      vec3 reflection = texture2DProj(tDiffuse, reflectionUv).rgb * uReflectionTint;

      float facing = max(dot(normal, viewDirection), 0.0);
      float fresnel = pow(1.0 - facing, 4.0);
      float ripples = valueNoise(p * 1.9 + vec2(t * 0.13, -t * 0.11));
      vec3 waterColor = mix(uDeepColor, uShallowColor, 0.28 + low * 0.09 + ripples * 0.08);
      vec3 color = mix(waterColor, reflection, clamp(0.12 + fresnel * 0.67 + low * 0.04, 0.0, 0.86));

      // Fine surface glints in the direction of the low sun.
      vec3 halfVector = normalize(uSunDirection + viewDirection);
      float glitter = pow(max(dot(normal, halfVector), 0.0), 320.0);
      float broad = pow(max(dot(normal, halfVector), 0.0), 28.0);
      color += uSunColor * (glitter * 0.85 + broad * 0.018);

      // Faint airborne salt bloom on the water.
      float fleck = smoothstep(0.76, 0.96, valueNoise(p * 3.8 + vec2(t * 0.08, -t * 0.05)));
      color += vec3(0.022, 0.032, 0.028) * fleck * smoothstep(2.0, 18.0, length(p));

      // A soft, shallow water shadow beneath the hull.
      float hullShadow = exp(-pow(p.x / 1.55, 2.0) - pow((p.y - 0.1) / 4.95, 2.0));
      color *= 1.0 - hullShadow * 0.34;

      // Atmospheric perspective towards the horizon.
      float distanceToCamera = length(cameraPosition - vWorldPosition);
      float fog = 1.0 - exp(-pow(distanceToCamera * 0.0082, 2.1));
      color = mix(color, uFogColor, clamp(fog, 0.0, 1.0));

      gl_FragColor = vec4(color, 1.0);
    }
  `
};

const SkyShader = {
  name: 'CormorantSky',
  uniforms: {
    uTop: { value: new THREE.Color(0x010506) },
    uHorizon: { value: new THREE.Color(0x0a201e) },
    uBottom: { value: new THREE.Color(0x010605) },
    uGlow: { value: new THREE.Color(0xc46d43) },
    uSunDirection: { value: new THREE.Vector3(0.52, 0.08, -0.78).normalize() }
  },
  vertexShader: /* glsl */ `
    varying vec3 vDirection;
    void main() {
      vDirection = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform vec3 uTop;
    uniform vec3 uHorizon;
    uniform vec3 uBottom;
    uniform vec3 uGlow;
    uniform vec3 uSunDirection;
    varying vec3 vDirection;

    float hash21(vec2 p) {
      p = fract(p * vec2(234.34, 435.345));
      p += dot(p, p + 34.23);
      return fract(p.x * p.y);
    }

    void main() {
      vec3 direction = normalize(vDirection);
      float h = direction.y;
      vec3 color = mix(uHorizon, uTop, smoothstep(0.0, 0.72, h));
      color = mix(uBottom, color, smoothstep(-0.32, 0.02, h));

      vec2 sunAzimuth = normalize(uSunDirection.xz);
      vec2 viewAzimuth = normalize(direction.xz + vec2(0.0001));
      float sunFacing = max(dot(viewAzimuth, sunAzimuth), 0.0);
      float horizonGlow = pow(sunFacing, 36.0) * exp(-abs(h) * 35.0);
      float lowHaze = pow(sunFacing, 8.0) * exp(-abs(h) * 28.0) * 0.035;
      color += uGlow * (horizonGlow * 0.16 + lowHaze);
      color += vec3(0.008, 0.022, 0.020) * exp(-abs(h) * 24.0);

      // Very soft cloud strata near the horizon, to keep the night alive.
      float strata = sin(direction.x * 8.0 + direction.z * 5.0 + h * 22.0)
                   * sin(direction.x * 17.0 - direction.z * 9.0 + 1.6);
      float cloudMask = smoothstep(0.05, 0.55, h) * smoothstep(0.78, 0.2, h);
      color += vec3(0.009, 0.014, 0.013) * (strata * 0.5 + 0.5) * cloudMask;

      // A tiny amount of ordered noise prevents gradient banding.
      color += (hash21(gl_FragCoord.xy) - 0.5) * 0.0025;
      gl_FragColor = vec4(color, 1.0);
    }
  `
};

function createEnvironment(renderer) {
  const envScene = new THREE.Scene();
  const sphereGeometry = new THREE.SphereGeometry(40, 48, 24);
  const sphereMaterial = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      uTop: { value: new THREE.Color(0x030b0d) },
      uHorizon: { value: new THREE.Color(0x224038) },
      uBottom: { value: new THREE.Color(0x020706) },
      uWarm: { value: new THREE.Color(0xffb17c).multiplyScalar(1.8) },
      uCool: { value: new THREE.Color(0x89c4c7).multiplyScalar(1.4) },
      uSunDirection: { value: new THREE.Vector3(0.52, 0.14, -0.78).normalize() }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uBottom;
      uniform vec3 uWarm;
      uniform vec3 uCool;
      uniform vec3 uSunDirection;
      varying vec3 vDirection;

      void main() {
        vec3 d = normalize(vDirection);
        float h = d.y;
        vec3 color = mix(uHorizon, uTop, smoothstep(0.0, 0.8, h));
        color = mix(uBottom, color, smoothstep(-0.4, 0.0, h));
        vec2 az = normalize(d.xz + vec2(0.0001));
        float sun = max(dot(az, normalize(uSunDirection.xz)), 0.0);
        color += uWarm * pow(sun, 14.0) * exp(-abs(h) * 4.0) * 0.55;
        color += uCool * pow(max(dot(d, normalize(vec3(-0.4, 0.5, 0.7))), 0.0), 8.0) * 0.32;
        gl_FragColor = vec4(color, 1.0);
      }
    `
  });
  envScene.add(new THREE.Mesh(sphereGeometry, sphereMaterial));

  // Large soft light sources for crisp, art-directed metal reflections.
  const panel = (width, height, position, rotation, color) => {
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    material.color.copy(color);
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
    mesh.position.copy(position);
    mesh.rotation.set(rotation.x, rotation.y, rotation.z);
    envScene.add(mesh);
  };
  panel(22, 8, new THREE.Vector3(0, 20, 0), new THREE.Euler(Math.PI / 2, 0, 0), new THREE.Color(0xf4f4e9).multiplyScalar(1.8));
  panel(5, 24, new THREE.Vector3(-19, 7, 3), new THREE.Euler(0, Math.PI / 2, 0), new THREE.Color(0x89d1d1).multiplyScalar(1.25));
  panel(9, 16, new THREE.Vector3(16, 4, -17), new THREE.Euler(0, -2.45, 0), new THREE.Color(0xffc29a).multiplyScalar(1.35));
  panel(28, 2.5, new THREE.Vector3(0, 2, -26), new THREE.Euler(0, 0, 0), new THREE.Color(0x4f7c75).multiplyScalar(0.9));

  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();
  const envRT = pmrem.fromScene(envScene, 0.075, 0.1, 100);
  envScene.traverse((object) => {
    if (object.geometry) object.geometry.dispose();
    if (object.material) object.material.dispose();
  });
  pmrem.dispose();
  return envRT;
}

function createStars(renderer) {
  const count = 150;
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const alphas = new Float32Array(count);
  let seed = 4173;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const azimuth = random() * Math.PI * 2;
    const elevation = 0.07 + Math.pow(random(), 0.72) * 1.3;
    const radius = 125;
    const horizontal = Math.cos(elevation) * radius;
    positions[i * 3] = Math.cos(azimuth) * horizontal;
    positions[i * 3 + 1] = Math.sin(elevation) * radius;
    positions[i * 3 + 2] = Math.sin(azimuth) * horizontal;
    sizes[i] = 0.6 + Math.pow(random(), 3) * 2.6;
    alphas[i] = 0.16 + random() * 0.62;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uColor: { value: new THREE.Color(0xd3e6de) },
      uPixelRatio: { value: renderer.getPixelRatio() }
    },
    vertexShader: /* glsl */ `
      attribute float aSize;
      attribute float aAlpha;
      uniform float uPixelRatio;
      varying float vAlpha;
      void main() {
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uPixelRatio;
        gl_Position = projectionMatrix * mvPosition;
        vAlpha = aAlpha;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - vec2(0.5));
        float alpha = smoothstep(0.5, 0.12, d) * vAlpha;
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor, alpha);
      }
    `
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, material };
}

function createMist(texture) {
  const count = 135;
  const positions = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  let seed = 8971;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < count; i++) {
    const angle = random() * Math.PI * 2;
    const radius = 2.2 + Math.pow(random(), 1.8) * 12;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 0.08 + random() * 1.7;
    positions[i * 3] = x;
    positions[i * 3 + 1] = y;
    positions[i * 3 + 2] = z;
    base[i * 3] = x;
    base[i * 3 + 1] = y;
    base[i * 3 + 2] = z;
    seeds[i] = random() * 10;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  const material = new THREE.PointsMaterial({
    map: texture,
    color: 0xa4c6ba,
    size: 0.68,
    sizeAttenuation: true,
    transparent: true,
    opacity: 0.145,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { points, base, seeds, count };
}

export function createStage({ container }) {
  const compact = window.matchMedia('(max-width: 720px)').matches;
  const dprCap = compact ? 1.35 : 1.65;
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.domElement.id = 'vessel-canvas';
  renderer.domElement.setAttribute('aria-label', 'Rotatable 3D model of the Cormorant C-7 autonomous survey vessel');
  renderer.domElement.setAttribute('role', 'img');
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x081b18, 0.0075);

  const camera = new THREE.PerspectiveCamera(33, window.innerWidth / window.innerHeight, 0.1, 300);
  camera.position.set(-7.9, 4.25, 9.6);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.02, 0.08);
  controls.enableDamping = true;
  controls.dampingFactor = 0.055;
  controls.rotateSpeed = 0.62;
  controls.zoomSpeed = 0.75;
  controls.panSpeed = 0.6;
  controls.enablePan = false;
  controls.minDistance = 4.6;
  controls.maxDistance = 21;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = 1.49;
  controls.autoRotate = false;
  controls.autoRotateSpeed = 0.46;
  controls.update();

  const environment = createEnvironment(renderer);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.7;

  // Sky dome.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(190, 64, 36),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      depthTest: false,
      uniforms: THREE.UniformsUtils.clone(SkyShader.uniforms),
      vertexShader: SkyShader.vertexShader,
      fragmentShader: SkyShader.fragmentShader
    })
  );
  sky.frustumCulled = false;
  sky.renderOrder = -100;
  scene.add(sky);

  // Lights.
  const hemisphere = new THREE.HemisphereLight(0x8cb4ae, 0x03100e, 0.35);
  scene.add(hemisphere);

  const key = new THREE.DirectionalLight(0xe1ede2, 1.3);
  key.position.set(-7.5, 9.2, 7.8);
  key.target.position.set(0, 0.5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(compact ? 1024 : 2048, compact ? 1024 : 2048);
  key.shadow.camera.left = -8;
  key.shadow.camera.right = 8;
  key.shadow.camera.top = 8;
  key.shadow.camera.bottom = -8;
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 28;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.02;
  scene.add(key);
  scene.add(key.target);

  const rim = new THREE.DirectionalLight(0xffc39a, 0.95);
  rim.position.set(9.5, 5.8, -8.2);
  rim.target.position.set(0, 0.8, 0);
  scene.add(rim);
  scene.add(rim.target);

  const topFill = new THREE.DirectionalLight(0x9ecac5, 0.4);
  topFill.position.set(1.5, 12, -1.5);
  scene.add(topFill);

  const bowFill = new THREE.DirectionalLight(0x86b6b8, 0.24);
  bowFill.position.set(-3, 2.2, 10);
  scene.add(bowFill);

  // Water. The Reflector's camera gives us a genuine mirror image that we tint and ripple.
  const reflectionScale = compact ? 0.54 : 0.68;
  const textureWidth = Math.min(2048, Math.round(window.innerWidth * renderer.getPixelRatio() * reflectionScale));
  const textureHeight = Math.min(1400, Math.round(window.innerHeight * renderer.getPixelRatio() * reflectionScale));
  const waterGeometry = new THREE.PlaneGeometry(360, 360);
  const water = new Reflector(waterGeometry, {
    clipBias: 0.003,
    textureWidth,
    textureHeight,
    color: 0x0d2722,
    shader: OceanShader,
    multisample: 2
  });
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0;
  water.name = 'Sea surface';
  scene.add(water);
  water.material.uniforms.uDeepColor.value.set(0x010909);
  water.material.uniforms.uShallowColor.value.set(0x072522);
  water.material.uniforms.uFogColor.value.set(0x061614);
  water.material.uniforms.uSunColor.value.set(0xb27b54);
  water.material.uniforms.uReflectionTint.value.set(0.66, 0.87, 0.83);

  // A distant channel marker gives the horizon a sense of scale.
  const buoy = new THREE.Group();
  buoy.position.set(24, 0, -21);
  const buoyBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.13, 0.75, 10), new THREE.MeshStandardMaterial({ color: 0xb9492d, roughness: 0.6 }));
  buoyBody.position.y = 0.34;
  buoy.add(buoyBody);
  const buoyBand = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.105, 0.16, 10), new THREE.MeshStandardMaterial({ color: 0xd8d5c8, roughness: 0.55 }));
  buoyBand.position.y = 0.46;
  buoy.add(buoyBand);
  const buoyLight = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffc071, toneMapped: false }));
  buoyLight.position.y = 0.82;
  buoy.add(buoyLight);
  scene.add(buoy);

  // Suspended salt haze.
  const particleTexture = makeParticleTexture();
  const mist = createMist(particleTexture);
  scene.add(mist.points);
  const stars = createStars(renderer);
  scene.add(stars.points);

  // Post pipeline.
  const renderTarget = new THREE.WebGLRenderTarget(window.innerWidth, window.innerHeight, {
    type: THREE.HalfFloatType,
    samples: compact ? 2 : 4
  });
  const composer = new EffectComposer(renderer, renderTarget);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(window.innerWidth, window.innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(
    new THREE.Vector2(window.innerWidth, window.innerHeight),
    0.12,
    0.42,
    1.55
  );
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const ratio = Math.min(window.devicePixelRatio || 1, dprCap);
    renderer.setPixelRatio(ratio);
    renderer.setSize(width, height);
    stars.material.uniforms.uPixelRatio.value = ratio;
    composer.setPixelRatio(ratio);
    composer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    bloom.setSize(width * ratio, height * ratio);
  }

  function update(time, delta) {
    water.material.uniforms.uTime.value = time;
    mist.points.material.opacity = 0.115 + Math.sin(time * 0.09) * 0.02;

    const positionAttribute = mist.points.geometry.attributes.position;
    for (let i = 0; i < mist.count; i++) {
      const seed = mist.seeds[i];
      const drift = time * (0.055 + seed * 0.004);
      positionAttribute.setX(i, mist.base[i * 3] + Math.sin(drift + seed) * (0.28 + seed * 0.03));
      positionAttribute.setY(i, mist.base[i * 3 + 1] + Math.sin(drift * 0.7 + seed * 1.7) * 0.12);
      positionAttribute.setZ(i, mist.base[i * 3 + 2] + Math.cos(drift * 0.8 + seed) * (0.22 + seed * 0.02));
    }
    positionAttribute.needsUpdate = true;

    // The buoy breathes, just enough to read as a real aid to navigation.
    buoyLight.material.color.setRGB(
      0.8 + Math.sin(time * 1.2) * 0.15,
      0.55,
      0.24
    );
  }

  function render() {
    composer.render();
  }

  return {
    renderer,
    scene,
    camera,
    controls,
    composer,
    water,
    sky,
    lights: { hemisphere, key, rim, topFill, bowFill },
    update,
    render,
    resize
  };
}

export { SkyShader, OceanShader };
