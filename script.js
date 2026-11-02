import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';

const ui = document.getElementById('ui');
const title = document.getElementById('title');
const subtitle = document.getElementById('subtitle');
const countEl = document.getElementById('count');
const threatEl = document.getElementById('threat');
const startBtn = document.getElementById('startBtn');
const messageBox = document.getElementById('messageBox');
const messageText = document.getElementById('messageText');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04070d);
scene.fog = new THREE.Fog(0x04070d, 9, 38);

const camera = new THREE.PerspectiveCamera(76, window.innerWidth / window.innerHeight, 0.1, 100);
camera.rotation.order = 'YXZ';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const clock = new THREE.Clock();
const keys = {};
const wallData = [];
const itemMeshes = [];
let monster;
let monsterState = 'stalking';
let gameStarted = false;
let gameEnded = false;
let canMoveCamera = false;
let messageTimer = 0;
let ambientPulse = 0;

const player = {
  position: new THREE.Vector3(0, 1.7, 12),
  radius: 0.52,
  speed: 5.6,
  yaw: Math.PI,
  pitch: 0,
};

const game = {
  needed: 5,
  found: 0,
  escaped: false,
  win: false,
};

function setMessage(text, duration = 2.4) {
  messageText.textContent = text;
  messageBox.hidden = false;
  messageTimer = duration;
}

function hideMessage() {
  messageBox.hidden = true;
  messageTimer = 0;
}

function playTone(freq, duration = 0.09, volume = 0.02) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const audioCtx = new (AudioContextClass)();
  const oscillator = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();

  oscillator.type = 'sawtooth';
  oscillator.frequency.value = freq;
  gainNode.gain.value = volume;
  oscillator.connect(gainNode);
  gainNode.connect(audioCtx.destination);

  oscillator.start();
  oscillator.stop(audioCtx.currentTime + duration);
  gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
}

function initLights() {
  const ambient = new THREE.AmbientLight(0x8aa9d6, 0.45);
  scene.add(ambient);

  const moon = new THREE.DirectionalLight(0xb7d8ff, 0.8);
  moon.position.set(6, 14, 10);
  moon.castShadow = true;
  moon.shadow.mapSize.width = 1024;
  moon.shadow.mapSize.height = 1024;
  moon.shadow.camera.left = -20;
  moon.shadow.camera.right = 20;
  moon.shadow.camera.top = 20;
  moon.shadow.camera.bottom = -20;
  scene.add(moon);

  const redLight = new THREE.PointLight(0xff4d4d, 1.2, 18, 2.2);
  redLight.position.set(0, 3.8, -5);
  scene.add(redLight);
}

function addWall(x, y, z, sx, sy, sz, color = 0x1b2635) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(sx, sy, sz),
    new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.2 })
  );
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  wallData.push({ x, z, sx, sz });
}

function addPlace(x, z, color) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(0.4, 0.45, 0.8, 12),
    new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.3 })
  );
  mesh.position.set(x, 0.9, z);
  mesh.castShadow = true;
  scene.add(mesh);
  itemMeshes.push(mesh);
}

function buildMaze() {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(40, 40),
    new THREE.MeshStandardMaterial({ color: 0x0a0f17, roughness: 0.96, metalness: 0.02 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.MeshStandardMaterial({ color: 0x111b28, roughness: 0.8 })
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.y = 0.01;
  scene.add(carpet);

  const exitDoor = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 3.6, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x8b5a3c, roughness: 0.8, metalness: 0.1 })
  );
  exitDoor.position.set(0, 1.8, -17.8);
  exitDoor.castShadow = true;
  scene.add(exitDoor);

  const wallSpecs = [
    [0, 2.5, 15, 24, 5, 1],
    [-7, 2.5, -15, 10, 5, 1],
    [7, 2.5, -15, 10, 5, 1],
    [-12, 2.5, 0, 1, 5, 30],
    [12, 2.5, 0, 1, 5, 30],
    [-6, 2.5, 7, 1, 5, 8],
    [6, 2.5, 7, 1, 5, 8],
    [-6, 2.5, -5, 1, 5, 8],
    [6, 2.5, -5, 1, 5, 8],
    [-1, 2.5, 0, 1, 5, 10],
    [4, 2.5, 0, 1, 5, 12],
    [0, 2.5, 10, 8, 5, 1],
    [0, 2.5, -10, 8, 5, 1],
    [-9, 2.5, 13, 5, 5, 1],
    [9, 2.5, -13, 5, 5, 1],
    [9, 2.5, 12, 5, 5, 1],
    [-9, 2.5, -12, 5, 5, 1],
    [0, 2.5, 3, 6, 5, 1],
    [0, 2.5, -3, 6, 5, 1],
  ];

  for (const [x, y, z, sx, sy, sz] of wallSpecs) {
    addWall(x, y, z, sx, sy, sz, 0x1f2937);
  }

  const itemPositions = [
    [-8, 12], [8, 12], [-10, 0], [10, 0], [-6, -12], [6, -12], [0, 8], [0, -8], [-2, 5], [2, -5],
  ];

  for (let i = 0; i < 5; i += 1) {
    const [x, z] = itemPositions[i];
    addPlace(x, z, i % 2 === 0 ? 0xffd166 : 0xf4a261);
  }

  const pillarPositions = [
    [-8, 8], [8, 8], [-8, -8], [8, -8], [0, -15], [0, 15]
  ];
  for (const [x, z] of pillarPositions) {
    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.9, 1.1, 6, 16),
      new THREE.MeshStandardMaterial({ color: 0x18212d, roughness: 0.8 })
    );
    pillar.position.set(x, 3, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    scene.add(pillar);
  }
}

function buildMonster() {
  const monsterGroup = new THREE.Group();

  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(1.1, 2.8, 8, 18),
    new THREE.MeshStandardMaterial({ color: 0x05080f, roughness: 0.9, metalness: 0.15 })
  );
  body.scale.set(1.2, 1.1, 1.1);
  body.position.y = 2.2;
  body.castShadow = true;
  monsterGroup.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.9, 22, 18),
    new THREE.MeshStandardMaterial({ color: 0x0a0d12, roughness: 1 })
  );
  head.position.set(0, 4, 0.2);
  head.castShadow = true;
  monsterGroup.add(head);

  const leftEye = new THREE.Mesh(
    new THREE.SphereGeometry(0.14, 14, 12),
    new THREE.MeshBasicMaterial({ color: 0xff4d4d })
  );
  leftEye.position.set(-0.28, 4.1, 0.8);
  monsterGroup.add(leftEye);

  const rightEye = leftEye.clone();
  rightEye.position.x = 0.28;
  monsterGroup.add(rightEye);

  const jaw = new THREE.Mesh(
    new THREE.TorusGeometry(0.48, 0.08, 10, 20, Math.PI),
    new THREE.MeshStandardMaterial({ color: 0x202a36, roughness: 0.6 })
  );
  jaw.rotation.x = Math.PI;
  jaw.position.set(0, 3.5, 0.72);
  monsterGroup.add(jaw);

  const armGeo = new THREE.CapsuleGeometry(0.18, 1.3, 5, 8);
  const leftArm = new THREE.Mesh(armGeo, new THREE.MeshStandardMaterial({ color: 0x06090f }));
  leftArm.position.set(-1.2, 2.6, 0.4);
  leftArm.rotation.z = -0.7;
  monsterGroup.add(leftArm);

  const rightArm = leftArm.clone();
  rightArm.position.x = 1.2;
  rightArm.rotation.z = 0.7;
  monsterGroup.add(rightArm);

  monsterGroup.position.set(0, 0, 14);
  scene.add(monsterGroup);
  monster = monsterGroup;
}

function updateThreatText() {
  if (gameEnded) {
    threatEl.textContent = game.win ? 'Escaped' : 'Caught';
    return;
  }

  const distance = monster.position.distanceTo(player.position);
  if (distance < 5) {
    threatEl.textContent = 'Immediate';
  } else if (distance < 9) {
    threatEl.textContent = 'Hunting';
  } else if (game.found >= game.needed) {
    threatEl.textContent = 'Door open';
  } else {
    threatEl.textContent = 'Calm';
  }
}

function updateUI() {
  countEl.textContent = String(game.needed - game.found);
  updateThreatText();
}

function collectItem(mesh) {
  const index = itemMeshes.indexOf(mesh);
  if (index === -1) return;

  itemMeshes.splice(index, 1);
  scene.remove(mesh);
  game.found += 1;
  playTone(440 + game.found * 60, 0.14, 0.035);
  setMessage('Found sahur bundle', 1.2);

  if (game.found >= game.needed) {
    setMessage('The front door is unlocked', 2.5);
    playTone(760, 0.2, 0.05);
    monsterState = 'rage';
  }

  updateUI();
}

function wallCollision(nextPos) {
  for (const wall of wallData) {
    const dx = Math.abs(nextPos.x - wall.x);
    const dz = Math.abs(nextPos.z - wall.z);
    const halfX = wall.sx / 2 + player.radius;
    const halfZ = wall.sz / 2 + player.radius;

    if (dx < halfX && dz < halfZ) {
      return true;
    }
  }

  const maxDist = 18.2;
  if (Math.abs(nextPos.x) > 18 || Math.abs(nextPos.z) > 18) return true;
  if (Math.abs(nextPos.x) < 2.6 && Math.abs(nextPos.z) > 15) return false;
  return Math.abs(nextPos.x) > maxDist || Math.abs(nextPos.z) > maxDist;
}

function movePlayer(delta) {
  const forward = new THREE.Vector3(Math.sin(player.yaw), 0, Math.cos(player.yaw));
  const right = new THREE.Vector3(forward.z, 0, -forward.x);
  const move = new THREE.Vector3();

  if (keys['KeyW'] || keys['ArrowUp']) move.add(forward);
  if (keys['KeyS'] || keys['ArrowDown']) move.sub(forward);
  if (keys['KeyA'] || keys['ArrowLeft']) move.sub(right);
  if (keys['KeyD'] || keys['ArrowRight']) move.add(right);

  if (move.lengthSq() > 0) {
    const running = keys['ShiftLeft'] || keys['ShiftRight'];
    move.normalize().multiplyScalar(player.speed * (running ? 1.55 : 1) * delta);
    const next = player.position.clone().add(move);
    if (!wallCollision(next)) {
      player.position.copy(next);
    }
  }

  player.position.x = THREE.MathUtils.clamp(player.position.x, -17.5, 17.5);
  player.position.z = THREE.MathUtils.clamp(player.position.z, -17.5, 17.5);

  camera.position.copy(player.position);
  camera.position.y = 1.7;
  camera.rotation.y = player.yaw;
  camera.rotation.x = player.pitch;
}

function finishGame(win) {
  gameEnded = true;
  game.win = win;
  document.exitPointerLock?.();
  setMessage(win ? 'You escaped the house' : 'The sahur demon got you', 3);
  title.textContent = win ? 'YOU SURVIVED' : 'YOU WERE CAUGHT';
  subtitle.textContent = win ? 'The dawn is here' : 'Try again before dawn';
  document.getElementById('instructions').textContent = win
    ? 'You made it through the night. The streets are quiet again.'
    : 'The footsteps stop. Then you hear the drum right behind you.';
  startBtn.textContent = 'Play again';
  ui.style.display = 'flex';
  threatEl.textContent = win ? 'Escaped' : 'Caught';
}

function updateMonster(delta) {
  if (!monster || !gameStarted || gameEnded) return;

  const target = player.position.clone();
  const dir = target.clone().sub(monster.position);
  const distance = dir.length();

  if (distance > 0.1) {
    dir.normalize();
    const speed = monsterState === 'rage' ? 4.2 : 2.2;
    const step = dir.multiplyScalar(speed * delta);
    const next = monster.position.clone().add(step);

    if (!wallCollision(next)) {
      monster.position.copy(next);
    } else {
      const alongX = monster.position.clone().add(new THREE.Vector3(step.x, 0, 0));
      const alongZ = monster.position.clone().add(new THREE.Vector3(0, 0, step.z));
      if (!wallCollision(alongX)) monster.position.copy(alongX);
      else if (!wallCollision(alongZ)) monster.position.copy(alongZ);
    }
  }

  monster.lookAt(player.position.x, player.position.y, player.position.z);
  monster.rotation.x = 0;
  monster.rotation.z = 0;

  if (distance < 1.6) {
    finishGame(false);
  }

  if (game.found >= game.needed && player.position.distanceTo(new THREE.Vector3(0, 1.7, -17)) < 2.5) {
    finishGame(true);
  }
}

function handleCollectibles() {
  for (const item of itemMeshes) {
    const distance = item.position.distanceTo(player.position);
    if (distance < 1.3) {
      collectItem(item);
    }
  }
}

function startGame() {
  if (gameStarted) return;
  gameStarted = true;
  ui.style.display = 'none';
  setMessage('Collect 5 sahur bundles and escape', 2.8);
  document.body.requestPointerLock?.();
  playTone(180, 0.2, 0.04);
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  requestAnimationFrame(animate);
  const delta = Math.min(clock.getDelta(), 0.05);

  if (gameStarted && !gameEnded) {
    movePlayer(delta);
    handleCollectibles();
    updateMonster(delta);
  }

  if (monster) {
    const pulse = 1 + Math.sin(performance.now() * 0.006) * 0.08;
    monster.scale.setScalar(pulse);
    ambientPulse += delta;
  }

  if (messageTimer > 0) {
    messageTimer -= delta;
    if (messageTimer <= 0) hideMessage();
  }

  renderer.render(scene, camera);
}

window.addEventListener('keydown', (event) => {
  keys[event.code] = true;
  if (event.code === 'Escape' && document.pointerLockElement) {
    document.exitPointerLock();
  }
});

window.addEventListener('keyup', (event) => {
  keys[event.code] = false;
});

document.addEventListener('pointerlockchange', () => {
  canMoveCamera = document.pointerLockElement === document.body;
});

document.addEventListener('mousemove', (event) => {
  if (!canMoveCamera || !gameStarted || gameEnded) return;
  player.yaw -= event.movementX * 0.0024;
  player.pitch -= event.movementY * 0.0018;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -1.4, 1.4);
});

startBtn.addEventListener('click', () => {
  if (gameEnded) {
    window.location.reload();
    return;
  }
  startGame();
});

const canvas = renderer.domElement;
let lastTouch = null;
canvas.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' && gameStarted && !gameEnded) {
    lastTouch = { x: event.clientX, y: event.clientY };
    canvas.setPointerCapture(event.pointerId);
  }
});
canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType !== 'touch' || !lastTouch || !gameStarted || gameEnded) return;
  const dx = event.clientX - lastTouch.x;
  const dy = event.clientY - lastTouch.y;
  player.yaw -= dx * 0.006;
  player.pitch = THREE.MathUtils.clamp(player.pitch - dy * 0.004, -1.35, 1.35);
  lastTouch = { x: event.clientX, y: event.clientY };
});
canvas.addEventListener('pointerup', () => { lastTouch = null; });
canvas.addEventListener('pointercancel', () => { lastTouch = null; });

document.querySelectorAll('#touchControls button[data-key]').forEach((button) => {
  const code = button.dataset.key;
  button.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    keys[code] = true;
    button.setPointerCapture(event.pointerId);
  });
  const stop = () => { keys[code] = false; };
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointercancel', stop);
  button.addEventListener('lostpointercapture', stop);
});

window.addEventListener('resize', onResize);

initLights();
buildMaze();
buildMonster();
monster.position.set(0, 0, -12);
updateUI();
animate();
