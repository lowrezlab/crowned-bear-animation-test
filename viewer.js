import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const modelURL = new URL('./bear-prototype-life-v3-v2.glb', import.meta.url);

export async function start(state) {
  const stage = document.querySelector('#stage');
  const idle = document.querySelector('#idle');
  const walk = document.querySelector('#walk');
  const pause = document.querySelector('#pause');
  const reset = document.querySelector('#reset');
  const buttons = [idle, walk, pause, reset];

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
  } catch (error) {
    throw new Error('webgl', { cause: error });
  }

  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Orbit around Crowned Bear');
  canvas.setAttribute('aria-describedby', 'orbit-help');
  canvas.hidden = true;
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  let gltf;
  try {
    const response = await fetch(modelURL, { signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error(`Model request returned ${response.status}`);
    const bytes = await response.arrayBuffer();
    if (state.dataset.state !== 'error') state.textContent = 'Preparing textures and clips…';
    gltf = await new GLTFLoader().parseAsync(bytes, new URL('.', modelURL).href);
    const textures = await gltf.parser.getDependencies('texture');
    if (textures.length !== 3 || textures.some((texture) => !texture?.image)) {
      throw new Error('textures');
    }
  } catch (error) {
    renderer.dispose();
    throw error;
  }

  const idleClip = THREE.AnimationClip.findByName(gltf.animations, 'Idle');
  const walkClip = THREE.AnimationClip.findByName(gltf.animations, 'Walk');
  if (!idleClip || !walkClip) {
    renderer.dispose();
    throw new Error('The GLB is missing an animation clip.');
  }

  const scene = new THREE.Scene();
  scene.add(gltf.scene, new THREE.HemisphereLight(0xfff3e7, 0xb5b0ca, 2.1));
  addLight(0xffede2, 2.6, [3, 5, 5]);
  addLight(0xdadfff, 1.6, [-3, 4, -4]);

  function addLight(color, intensity, position) {
    const light = new THREE.DirectionalLight(color, intensity);
    light.position.set(...position);
    scene.add(light);
  }

  const bounds = new THREE.Box3().setFromObject(gltf.scene, true);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const camera = new THREE.PerspectiveCamera(36, 1, sphere.radius / 100, sphere.radius * 40);
  // The portrait stage frames the full bear, even on a narrow screen.
  const profile = new THREE.Vector3(0.35, 0.07, 1).normalize();
  stage.prepend(canvas);
  const orbit = new OrbitControls(camera, canvas);
  orbit.enablePan = false;
  orbit.minDistance = sphere.radius * 0.8;
  orbit.maxDistance = sphere.radius * 16;

  function fitView() {
    const halfHeight = THREE.MathUtils.degToRad(camera.fov / 2);
    const halfWidth = Math.atan(Math.tan(halfHeight) * camera.aspect);
    const distance = sphere.radius / Math.sin(Math.min(halfHeight, halfWidth)) * 1.08;
    orbit.target.copy(sphere.center);
    camera.position.copy(sphere.center).addScaledVector(profile, distance);
    orbit.update();
  }

  let previousAspect = 0;
  function resize() {
    const { clientWidth: width, clientHeight: height } = stage;
    if (width === 0 || height === 0) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    if (Math.abs(previousAspect - camera.aspect) > 0.1) {
      fitView();
      previousAspect = camera.aspect;
    }
  }

  canvas.addEventListener('keydown', (event) => {
    const movement = {
      ArrowLeft: [-0.15, 0], ArrowRight: [0.15, 0],
      ArrowUp: [0, -0.12], ArrowDown: [0, 0.12],
    }[event.key];
    if (!Array.isArray(movement)) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(orbit.target);
    const angle = new THREE.Spherical().setFromVector3(offset);
    angle.theta += movement[0];
    angle.phi += movement[1];
    angle.makeSafe();
    camera.position.copy(orbit.target).add(offset.setFromSpherical(angle));
    orbit.update();
  });

  const mixer = new THREE.AnimationMixer(gltf.scene);
  const idleAction = mixer.clipAction(idleClip);
  const walkAction = mixer.clipAction(walkClip);
  let currentAction;
  let paused = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function select(action) {
    if (action === currentAction) return;
    currentAction?.stop();
    currentAction = action;
    action.reset().play();
    mixer.update(0);
    idle.setAttribute('aria-pressed', String(action === idleAction));
    walk.setAttribute('aria-pressed', String(action === walkAction));
  }

  function updatePauseLabel() {
    pause.textContent = paused ? 'Play' : 'Pause';
  }

  idle.addEventListener('click', () => select(idleAction));
  walk.addEventListener('click', () => select(walkAction));
  pause.addEventListener('click', () => {
    paused = !paused;
    updatePauseLabel();
  });
  reset.addEventListener('click', fitView);

  const observer = new ResizeObserver(resize);
  canvas.addEventListener('webglcontextlost', (event) => {
    event.preventDefault();
    renderer.setAnimationLoop(null);
    observer.disconnect();
    buttons.forEach((button) => { button.disabled = true; });
    state.textContent = 'The 3D view stopped. Reload to restart it.';
    state.dataset.state = 'error';
    state.hidden = false;
  });

  select(idleAction);
  updatePauseLabel();
  canvas.hidden = false;
  resize();
  renderer.render(scene, camera);
  observer.observe(stage);
  delete state.dataset.state;
  state.hidden = true;
  buttons.forEach((button) => { button.disabled = false; });

  let previousTime;
  renderer.setAnimationLoop((time) => {
    const elapsed = previousTime === undefined ? 0 : (time - previousTime) / 1000;
    previousTime = time;
    if (!paused) mixer.update(Math.min(elapsed, 0.1));
    renderer.render(scene, camera);
  });
}
