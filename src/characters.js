import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Playable characters. Every build returns a Group ~2.2 m tall with
 * userData.parts = { flame, f1, f2, wing, visor } (contract used by Player + remotes).
 * Optionally armL/armR where the character has arms — golf drives these for the swing.
 * Saturn V and the UFO have none, so any consumer must treat them as optional.
 */

function makeFlame(scale = 1, y = 0.05) {
  const flameMat = new THREE.MeshBasicMaterial({ color: 0xffa62b, transparent: true, opacity: 0.9 });
  const flameCore = new THREE.MeshBasicMaterial({ color: 0xfff1a8, transparent: true, opacity: 0.95 });
  const flame = new THREE.Group();
  const f1 = new THREE.Mesh(new THREE.ConeGeometry(0.26 * scale, 0.9 * scale, 12), flameMat); f1.rotation.x = Math.PI; f1.position.y = -0.4 * scale;
  const f2 = new THREE.Mesh(new THREE.ConeGeometry(0.13 * scale, 0.55 * scale, 12), flameCore); f2.rotation.x = Math.PI; f2.position.y = -0.25 * scale;
  flame.add(f1, f2); flame.position.y = y; flame.visible = false;
  return { flame, f1, f2 };
}

function makeWing(y = 1.2) {
  const wing = new THREE.Group();
  const wingMat = new THREE.MeshStandardMaterial({ color: 0xffb347, roughness: 0.6, side: THREE.DoubleSide });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f24 });
  const panel = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.05, 0.9), wingMat); panel.position.set(0, y, 0.05);
  const spar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 3.6, 8).rotateZ(Math.PI / 2), dark); spar.position.set(0, y + 0.02, 0.4);
  wing.add(panel, spar); wing.visible = false;
  return wing;
}

function saturnTexture({ w = 512, h = 512, text = 'USA', stripesTop = true, stripesBottom = true } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f6f8'; g.fillRect(0, 0, w, h);
  g.fillStyle = '#1b1f24';
  const q = w / 4;
  if (stripesTop) for (let i = 0; i < 4; i += 2) g.fillRect(i * q, 0, q, h * 0.16);
  if (stripesBottom) for (let i = 1; i < 4; i += 2) g.fillRect(i * q, h * 0.78, q, h * 0.22);
  g.fillRect(0, h * 0.16, w, h * 0.02);
  g.fillRect(0, h * 0.76, w, h * 0.02);
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const cx of [w * 0.125, w * 0.625]) {
    g.font = `bold ${h * 0.11}px Menlo, monospace`; g.fillStyle = '#1b1f24';
    g.save(); g.translate(cx, h * 0.47); g.rotate(-Math.PI / 2); g.fillText(text, 0, 0); g.restore();
    const fx = cx - w * 0.06, fy = h * 0.6, fw = w * 0.12, fh = h * 0.08;
    g.fillStyle = '#b22234'; g.fillRect(fx, fy, fw, fh);
    g.fillStyle = '#ffffff'; for (let i = 1; i < 7; i += 2) g.fillRect(fx, fy + (fh / 7) * i, fw, fh / 7);
    g.fillStyle = '#3c3b6e'; g.fillRect(fx, fy, fw * 0.42, fh * 0.55);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

export function buildSaturnV() {
  const g = new THREE.Group();
  const white = new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 0.5 });
  const black = new THREE.MeshStandardMaterial({ color: 0x1b1f24, roughness: 0.6 });
  const silver = new THREE.MeshStandardMaterial({ color: 0xb8bec4, roughness: 0.35, metalness: 0.6 });
  const stage1Mat = new THREE.MeshStandardMaterial({ map: saturnTexture({ text: 'USA' }), roughness: 0.5 });
  const stage2Mat = new THREE.MeshStandardMaterial({ map: saturnTexture({ text: 'UNITED STATES', stripesTop: false }), roughness: 0.5 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd3ff, roughness: 0.1, metalness: 0.4, emissive: 0x1a4a70, emissiveIntensity: 0.4 });

  const R = 0.36;
  const s1 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.85, 28), stage1Mat); s1.position.y = 0.62; g.add(s1);
  const s2 = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.55, 28), stage2Mat); s2.position.y = 1.32; g.add(s2);
  const taper = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.68, R, 0.14, 28), white); taper.position.y = 1.665; g.add(taper);
  const s3 = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.68, R * 0.68, 0.32, 28), white); s3.position.y = 1.89; g.add(s3);
  const s3band = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.685, R * 0.685, 0.05, 28), black); s3band.position.y = 1.74; g.add(s3band);
  const sm = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.5, R * 0.68, 0.16, 24), silver); sm.position.y = 2.13; g.add(sm);
  const cm = new THREE.Mesh(new THREE.ConeGeometry(R * 0.5, 0.3, 24), silver); cm.position.y = 2.36; g.add(cm);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.035, 0.32, 8), white); tower.position.y = 2.66; g.add(tower);
  const towerTip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 8), black); towerTip.position.y = 2.86; g.add(towerTip);
  const vis = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20), glass); vis.position.set(0, 2.3, -R * 0.36); vis.rotation.y = Math.PI; g.add(vis);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x0b1a2a });
  const eyeL = new THREE.Mesh(new THREE.CircleGeometry(0.018, 10), eyeMat); eyeL.position.set(-0.028, 2.31, -R * 0.36 - 0.003); eyeL.rotation.y = Math.PI;
  const eyeR = eyeL.clone(); eyeR.position.x = 0.028; g.add(eyeL, eyeR);
  const finShape = new THREE.Shape(); finShape.moveTo(0, 0); finShape.lineTo(0.22, -0.16); finShape.lineTo(0.22, 0.0); finShape.lineTo(0, 0.34); finShape.closePath();
  const finGeo = new THREE.ExtrudeGeometry(finShape, { depth: 0.05, bevelEnabled: false }); finGeo.translate(0, 0, -0.025);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const f = new THREE.Mesh(finGeo, black); f.position.set(Math.cos(a) * (R - 0.02), 0.34, Math.sin(a) * (R - 0.02)); f.rotation.y = -a; g.add(f);
    const fair = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.09, 0.3, 10), white);
    const b = a + Math.PI / 4; fair.position.set(Math.cos(b) * (R - 0.03), 0.3, Math.sin(b) * (R - 0.03)); g.add(fair);
  }
  const engGeo = new THREE.CylinderGeometry(0.06, 0.1, 0.16, 12);
  [[0, 0], [0.16, 0.16], [-0.16, 0.16], [0.16, -0.16], [-0.16, -0.16]].forEach(([x, z]) => {
    const e = new THREE.Mesh(engGeo, silver); e.position.set(x, 0.12, z); g.add(e);
  });
  const { flame, f1, f2 } = makeFlame(1, 0.05); g.add(flame);
  const wing = makeWing(1.2); g.add(wing);
  [s1, s2, vis, f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.parts = { flame, f1, f2, wing, visor: vis };
  return g;
}

/** Rocket City Trash Panda — raccoon with a jetpack and a baseball cap. */
export function buildTrashPanda() {
  const g = new THREE.Group();
  const grayFur = new THREE.MeshStandardMaterial({ color: 0x8a8f96, roughness: 0.9 });
  const darkFur = new THREE.MeshStandardMaterial({ color: 0x3a3d42, roughness: 0.9 });
  const lightFur = new THREE.MeshStandardMaterial({ color: 0xd9dbdd, roughness: 0.9 });
  const black = new THREE.MeshStandardMaterial({ color: 0x101215, roughness: 0.6 });
  const capRed = new THREE.MeshStandardMaterial({ color: 0xc8102e, roughness: 0.55 });

  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.34, 0.35, 6, 16), grayFur); body.position.y = 0.72; g.add(body);
  const belly = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), lightFur); belly.position.set(0, 0.62, -0.16); belly.scale.set(1, 1.15, 0.55); g.add(belly);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 14), grayFur); head.position.y = 1.38; head.scale.set(1, 0.92, 0.95); g.add(head);
  // mask
  const mask = new THREE.Mesh(new THREE.SphereGeometry(0.305, 16, 10, 0, Math.PI * 2, Math.PI * 0.34, Math.PI * 0.22), darkFur);
  mask.position.y = 1.38; mask.scale.set(1, 0.92, 0.95); mask.rotation.x = -0.15; g.add(mask);
  // eyes on the mask (front = -Z)
  const eyeW = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), lightFur);
  eyeW.position.set(-0.11, 1.42, -0.25); const eyeW2 = eyeW.clone(); eyeW2.position.x = 0.11; g.add(eyeW, eyeW2);
  const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.028, 8, 6), black); pupil.position.set(-0.11, 1.43, -0.295);
  const pupil2 = pupil.clone(); pupil2.position.x = 0.11; g.add(pupil, pupil2);
  // snout + nose
  const snout = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 12), lightFur); snout.rotation.x = -Math.PI / 2; snout.position.set(0, 1.3, -0.32); g.add(snout);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), black); nose.position.set(0, 1.31, -0.43); g.add(nose);
  // ears
  const earGeo = new THREE.ConeGeometry(0.09, 0.16, 8);
  const earL = new THREE.Mesh(earGeo, grayFur); earL.position.set(-0.18, 1.66, -0.02); earL.rotation.z = 0.25;
  const earR = earL.clone(); earR.position.x = 0.18; earR.rotation.z = -0.25; g.add(earL, earR);
  // baseball cap
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.24, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45), capRed);
  cap.position.set(0, 1.6, 0.02); g.add(cap);
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 14, 1, false, Math.PI * 0.75, Math.PI * 0.5), capRed);
  brim.position.set(0, 1.62, -0.22); g.add(brim);
  // arms + legs
  const armGeo = new THREE.CapsuleGeometry(0.08, 0.3, 4, 8);
  const armL = new THREE.Mesh(armGeo, grayFur); armL.position.set(-0.4, 0.85, 0); armL.rotation.z = 0.3;
  const armR = armL.clone(); armR.position.x = 0.4; armR.rotation.z = -0.3; g.add(armL, armR);
  const legGeo = new THREE.CapsuleGeometry(0.1, 0.22, 4, 8);
  const legL = new THREE.Mesh(legGeo, darkFur); legL.position.set(-0.16, 0.22, 0);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legL, legR);
  // striped tail
  for (let i = 0; i < 5; i++) {
    const seg = new THREE.Mesh(new THREE.SphereGeometry(0.11 - i * 0.012, 10, 8), i % 2 ? darkFur : grayFur);
    seg.position.set(0, 0.45 + i * 0.14, 0.42 + i * 0.1);
    g.add(seg);
  }
  // jetpack
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.42, 0.16), black); pack.position.set(0, 0.95, 0.34); g.add(pack);
  const { flame, f1, f2 } = makeFlame(0.7, 0.35); flame.position.z = 0.34; g.add(flame);
  const wing = makeWing(1.1); g.add(wing);
  g.userData.parts = { flame, f1, f2, wing, visor: pupil, armL, armR };
  return g;
}

export function buildAstronaut() {
  const g = new THREE.Group();
  const suit = new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.7 });
  const accent = new THREE.MeshStandardMaterial({ color: 0xff7a1a, roughness: 0.5 });
  const visorMat = new THREE.MeshStandardMaterial({ color: 0xf5b800, metalness: 0.9, roughness: 0.15 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f24 });
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.55, 4, 10), suit); torso.position.y = 0.95; g.add(torso);
  const chest = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.08), accent); chest.position.set(0, 1.05, -0.27); g.add(chest);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.22), dark); pack.position.set(0, 1.05, 0.32); g.add(pack);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.26, 14, 12), suit); helmet.position.y = 1.58; g.add(helmet);
  const vis = new THREE.Mesh(new THREE.SphereGeometry(0.2, 14, 12, 0, Math.PI), visorMat); vis.position.set(0, 1.58, -0.1); vis.rotation.y = Math.PI; g.add(vis);
  const armGeo = new THREE.CapsuleGeometry(0.09, 0.45, 3, 8);
  const armL = new THREE.Mesh(armGeo, suit); armL.position.set(-0.4, 1.0, 0); armL.rotation.z = 0.15;
  const armR = armL.clone(); armR.position.x = 0.4; armR.rotation.z = -0.15; g.add(armL, armR);
  const legGeo = new THREE.CapsuleGeometry(0.11, 0.5, 3, 8);
  const legL = new THREE.Mesh(legGeo, suit); legL.position.set(-0.16, 0.38, 0);
  const legR = legL.clone(); legR.position.x = 0.16; g.add(legL, legR);
  const bootGeo = new THREE.BoxGeometry(0.2, 0.12, 0.32);
  const bootL = new THREE.Mesh(bootGeo, accent); bootL.position.set(-0.16, 0.06, -0.04);
  const bootR = bootL.clone(); bootR.position.x = 0.16; g.add(bootL, bootR);
  const { flame, f1, f2 } = makeFlame(0.7, 0.5); flame.position.z = 0.32; g.add(flame);
  const wing = makeWing(1.15); g.add(wing);
  g.userData.parts = { flame, f1, f2, wing, visor: vis, armL, armR };
  return g;
}

export function buildUFO() {
  const g = new THREE.Group();
  const hull = new THREE.MeshStandardMaterial({ color: 0x9aa4ad, metalness: 0.8, roughness: 0.25 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd3ff, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.75, emissive: 0x1a4a70, emissiveIntensity: 0.5 });
  const saucer = new THREE.Mesh(new THREE.SphereGeometry(0.85, 24, 12), hull); saucer.scale.set(1, 0.25, 1); saucer.position.y = 0.8; g.add(saucer);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.08, 10, 28).rotateX(Math.PI / 2), hull); rim.position.y = 0.8; g.add(rim);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.4, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), glass); dome.position.y = 0.94; g.add(dome);
  // little green pilot
  const green = new THREE.MeshStandardMaterial({ color: 0x57d977, roughness: 0.7 });
  const alien = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), green); alien.position.y = 1.06; alien.scale.set(0.8, 1.2, 0.8); g.add(alien);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: 0x101215 })); eye.position.set(0, 1.14, -0.11); g.add(eye);
  // ring lights
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), lightMat);
    l.position.set(Math.cos(a) * 0.68, 0.72, Math.sin(a) * 0.68); g.add(l);
  }
  const { flame, f1, f2 } = makeFlame(0.9, 0.55); g.add(flame);
  const wing = makeWing(1.0); g.add(wing);
  g.userData.parts = { flame, f1, f2, wing, visor: dome };
  return g;
}

/** Flat nameplate for the cab side — readable, unlike text wrapped round a boiler. */
function cabPlateTexture({ w = 512, h = 128, text = 'CHATTANOOGA' } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.fillStyle = '#2b3034'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a227'; g.lineWidth = 6; g.strokeRect(9, 9, w - 18, h - 18);
  // Fit the word to the plate instead of hoping it lands: the first version of this
  // hard-coded a size, overran the canvas and read on the model as a misspelling.
  let px = h * 0.46;
  g.font = `bold ${px}px Menlo, monospace`;
  const over = g.measureText(text).width / (w - 56);
  if (over > 1) { px = Math.floor(px / over); g.font = `bold ${px}px Menlo, monospace`; }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = '#e8c352'; g.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return tex;
}

/**
 * Chattanooga Choo Choo — a 4-4-0 American steam locomotive, flying nose-forward.
 * Original art and a nominative name, same as the Trash Panda: no railroad or hotel
 * mark is reproduced.
 *
 * Built HORIZONTAL, unlike every other character here, and that is the whole point. A
 * locomotive is defined by its side profile — long boiler, big spoked drivers beneath,
 * cab behind, flared stack on top. Stood on end it reads as a barrel, not a train; the
 * first attempt at this did exactly that. Player only ever leans the mesh a few degrees
 * (rotation.x tops out near 0.45 rad), so a horizontal model flies level and nose-first,
 * and sits sensibly on the ground when walking.
 *
 * Forward is -Z, matching the other characters. The exhaust fires backwards out of the
 * cab rather than downwards, so parts.flame still just toggles .visible.
 */
export function buildChooChoo() {
  const g = new THREE.Group();
  const black = new THREE.MeshStandardMaterial({ color: 0x16191c, roughness: 0.62 });
  const graphite = new THREE.MeshStandardMaterial({ color: 0x2b3034, roughness: 0.7 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.28, metalness: 0.85 });
  const red = new THREE.MeshStandardMaterial({ color: 0xb01b22, roughness: 0.55 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd3ff, roughness: 0.1, metalness: 0.4, emissive: 0x1a4a70, emissiveIntensity: 0.4 });
  const lampGlass = new THREE.MeshStandardMaterial({ color: 0xffe9a8, roughness: 0.1, emissive: 0xffc447, emissiveIntensity: 1.1 });
  const plateMat = new THREE.MeshStandardMaterial({ map: cabPlateTexture(), roughness: 0.6 });

  const BR = 0.30;                       // boiler radius
  const AXIS = Math.PI / 2;              // lay a cylinder along Z

  // ---- boiler + smokebox, running front (-Z) to cab ----
  const boiler = new THREE.Mesh(new THREE.CylinderGeometry(BR, BR, 1.55, 26), black);
  boiler.rotation.x = AXIS; boiler.position.set(0, 0.80, -0.22); g.add(boiler);
  for (let i = 0; i < 4; i++) {          // brass boiler bands
    const band = new THREE.Mesh(new THREE.CylinderGeometry(BR * 1.03, BR * 1.03, 0.035, 26), brass);
    band.rotation.x = AXIS; band.position.set(0, 0.80, -0.85 + i * 0.36); g.add(band);
  }
  const smokebox = new THREE.Mesh(new THREE.CylinderGeometry(BR * 1.05, BR * 1.05, 0.42, 26), graphite);
  smokebox.rotation.x = AXIS; smokebox.position.set(0, 0.80, -1.18); g.add(smokebox);
  const door = new THREE.Mesh(new THREE.CircleGeometry(BR * 0.92, 22), black);
  door.position.set(0, 0.80, -1.395); door.rotation.y = Math.PI; g.add(door);
  const doorRing = new THREE.Mesh(new THREE.TorusGeometry(BR * 0.92, 0.026, 8, 24), brass);
  doorRing.position.set(0, 0.80, -1.39); g.add(doorRing);

  // ---- flared funnel on top of the smokebox: the single most locomotive thing here ----
  const stackBase = new THREE.Mesh(new THREE.CylinderGeometry(0.10, 0.125, 0.20, 16), black);
  stackBase.position.set(0, 1.16, -1.14); g.add(stackBase);
  const stackFlare = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.105, 0.28, 20, 1, true), black);
  stackFlare.position.set(0, 1.39, -1.14); g.add(stackFlare);
  const stackLip = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.026, 8, 22), brass);
  stackLip.position.set(0, 1.53, -1.14); stackLip.rotation.x = AXIS; g.add(stackLip);

  // ---- domes + bell along the boiler top ----
  const steamDome = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass);
  steamDome.position.set(0, 1.06, -0.36); g.add(steamDome);
  const sandDome = new THREE.Mesh(new THREE.SphereGeometry(0.125, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), brass);
  sandDome.position.set(0, 1.06, 0.10); g.add(sandDome);
  const bell = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.11, 12), brass);
  bell.position.set(0, 1.12, -0.72); bell.rotation.x = Math.PI; g.add(bell);

  // ---- headlamp above the smokebox door ----
  const lampBox = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.20, 0.17), graphite);
  lampBox.position.set(0, 1.20, -1.36); g.add(lampBox);
  const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.072, 20), lampGlass);
  lamp.position.set(0, 1.20, -1.447); lamp.rotation.y = Math.PI; g.add(lamp);

  // ---- cowcatcher: slatted wedge sloping down to the rail ----
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const halfW = 0.30 * (1 - t * 0.62);
    const slat = new THREE.Mesh(new THREE.BoxGeometry(halfW * 2, 0.045, 0.04), red);
    slat.position.set(0, 0.52 - t * 0.42, -1.50 - t * 0.30);
    slat.rotation.x = -0.62; g.add(slat);
  }
  const buffer = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.07, 0.10), red);
  buffer.position.set(0, 0.56, -1.48); g.add(buffer);

  // ---- cab at the rear ----
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.66, 0.72), graphite);
  cab.position.set(0, 0.92, 0.90); g.add(cab);
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(0.88, 0.06, 0.86), black);
  cabRoof.position.set(0, 1.28, 0.90); g.add(cabRoof);
  for (const sx of [-1, 1]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.24), glass);
    win.position.set(sx * 0.392, 1.06, 0.78); win.rotation.y = sx * Math.PI / 2; g.add(win);
  }

  // Nameplate on the back of the cab: the chase camera sits behind the player, so this is
  // the one face always in view, and it is clear of the rear driver that was cutting the
  // word in half on the cab sides.
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.70, 0.17), plateMat);
  plate.position.set(0, 0.92, 1.263); g.add(plate);

  // ---- wheels: two small leading, two big drivers, red spokes + side rod ----
  const wheels = [[-1.06, 0.20], [-0.72, 0.20], [0.12, 0.40], [0.72, 0.40]];
  for (const sx of [-1, 1]) {
    for (const [wz, wr] of wheels) {
      const x = sx * (BR + 0.10);
      const tyre = new THREE.Mesh(new THREE.TorusGeometry(wr, 0.048, 8, 20), black);
      tyre.position.set(x, wr, wz); tyre.rotation.y = AXIS; g.add(tyre);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(wr * 0.28, wr * 0.28, 0.06, 12), red);
      hub.position.set(x, wr, wz); hub.rotation.z = AXIS; g.add(hub);
      const spokes = wr > 0.3 ? 6 : 4;
      for (let k = 0; k < spokes; k++) {
        const a = (k / spokes) * Math.PI;
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.03, wr * 1.85, 0.03), red);
        // axle runs along X, so the spokes must lie in the Y-Z plane — rotate about X only
        spoke.position.set(x, wr, wz); spoke.rotation.x = a; g.add(spoke);
      }
    }
    const rod = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.05, 0.86), brass);   // side rod
    rod.position.set(sx * (BR + 0.16), 0.40, 0.42); g.add(rod);
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.20, 0.34), graphite); // steam chest
    chest.position.set(sx * (BR + 0.06), 0.52, -0.98); g.add(chest);
  }

  // ---- exhaust out the back, not the bottom ----
  const { flame, f1, f2 } = makeFlame(1, 0);
  flame.rotation.x = -Math.PI / 2;          // point the cones astern (+Z)
  flame.position.set(0, 0.80, 1.30); g.add(flame);
  const wing = makeWing(1.05); g.add(wing);
  [lamp, f1, f2].forEach((m) => { m.userData.noTint = true; });
  // Built lying down with the nose already at -Z, unlike the upright characters. Player
  // leans those forward from vertical to point them into travel; doing that to this one
  // drives its nose below the horizon, further the faster you go. Flag it so the lean is
  // damped rather than re-applied.
  g.userData.noseForward = true;
  g.userData.parts = { flame, f1, f2, wing, visor: lamp };
  return g;
}

/** Gold mirror-glass wrap: bright warm panels with fine mullions between them. */
function sunsphereTexture({ w = 512, h = 256 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#fff0b8'); grad.addColorStop(0.35, '#f6cf5c');
  grad.addColorStop(0.7, '#e0ac33'); grad.addColorStop(1, '#c9922a');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  g.strokeStyle = 'rgba(90,62,14,0.42)'; g.lineWidth = 1.5;
  for (let i = 0; i <= 32; i++) { const x = (w / 32) * i; g.beginPath(); g.moveTo(x, 0); g.lineTo(x, h); g.stroke(); }
  for (let i = 0; i <= 14; i++) { const y = (h / 14) * i; g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke(); }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

/**
 * Knoxville Sunsphere — the 1982 World's Fair tower, flown sphere-up.
 * Original art of a public landmark, named for its place, in the same spirit as the
 * stadium roundels: no logo or mark is reproduced.
 *
 * Proportioned from the real thing: a tall, slim, BLUE six-legged steel lattice shaft with pale
 * infill panels, carrying a comparatively small gold mirror-glass sphere. The first cut
 * of this had a short white truss under an oversized orb and read as a water tower.
 *
 * Upright like the Saturn V, so no noseForward flag — but the silhouette is deliberately
 * the opposite: a slim open mast with a bulb on top, against one smooth tapering cylinder.
 */
export function buildSunsphere() {
  const g = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: 0x2159c4, roughness: 0.45, metalness: 0.35 });
  const blueDark = new THREE.MeshStandardMaterial({ color: 0x18428f, roughness: 0.5, metalness: 0.3 });
  const panel = new THREE.MeshStandardMaterial({ color: 0xe4e9ee, roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide });
  const steel = new THREE.MeshStandardMaterial({ color: 0xc8ced4, roughness: 0.5, metalness: 0.4 });
  // metalness stays moderate: there is no environment map in this scene, so a fully
  // metallic sphere renders near-black instead of gold.
  const gold = new THREE.MeshStandardMaterial({
    map: sunsphereTexture(), roughness: 0.22, metalness: 0.42, emissive: 0x5a4210, emissiveIntensity: 0.75,
  });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8e8, roughness: 0.15, metalness: 0.3, emissive: 0x14384f, emissiveIntensity: 0.35 });

  // ---- proportions taken from the real tower: slim shaft, comparatively small sphere ----
  const SR = 0.30;                 // sphere radius
  const TOP = 2.02;                // top of the shaft (sphere sits just above)
  const BOT = 0.10;
  const R_TOP = 0.150, R_BOT = 0.255;     // shaft radius, tapering upward
  const LEGS = 6;                  // hexagonal shaft
  const BAYS = 6;

  const cornerAt = (i, y) => {
    const t = (y - BOT) / (TOP - BOT);
    const rad = R_BOT + (R_TOP - R_BOT) * t;
    const a = (i / LEGS) * Math.PI * 2 + Math.PI / LEGS;
    return new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad);
  };

  // The lattice is static, so every bar and panel is baked into one merged mesh per
  // material at build time. Added individually this came to 171 draw calls for the player
  // model alone, against 29 for the Saturn V; merged it is a handful.
  const blueParts = [], panelParts = [], darkParts = [];
  const bake = (bucket, geo, obj) => { obj.updateMatrix(); bucket.push(geo.clone().applyMatrix4(obj.matrix)); };

  // corner columns
  for (let i = 0; i < LEGS; i++) {
    const a = cornerAt(i, BOT), b = cornerAt(i, TOP);
    const colG = new THREE.BoxGeometry(0.052, a.distanceTo(b), 0.052);
    const col = new THREE.Object3D();
    col.position.copy(a).add(b).multiplyScalar(0.5);
    col.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    bake(blueParts, colG, col);
    const footG = new THREE.BoxGeometry(0.10, 0.07, 0.10);
    const foot = new THREE.Object3D(); foot.position.set(a.x, 0.035, a.z);
    bake(darkParts, footG, foot);
  }

  // stacked bays: a blue collar, an X of bracing, and a pale infill panel behind it
  for (let bIdx = 0; bIdx <= BAYS; bIdx++) {
    const y = BOT + ((TOP - BOT) / BAYS) * bIdx;
    const ring = [];
    for (let i = 0; i < LEGS; i++) ring.push([cornerAt(i, y), cornerAt((i + 1) % LEGS, y)]);
    for (const [p, q] of ring) {
      const barG = new THREE.BoxGeometry(p.distanceTo(q), 0.042, 0.042);
      const bar = new THREE.Object3D();
      bar.position.copy(p).add(q).multiplyScalar(0.5);
      bar.lookAt(q); bar.rotateY(Math.PI / 2);
      bake(blueParts, barG, bar);
    }
    if (bIdx === BAYS) break;
    const yTop = BOT + ((TOP - BOT) / BAYS) * (bIdx + 1);
    for (let f = 0; f < LEGS; f++) {
      const lo0 = cornerAt(f, y), lo1 = cornerAt((f + 1) % LEGS, y);
      const hi0 = cornerAt(f, yTop), hi1 = cornerAt((f + 1) % LEGS, yTop);
      // Pale infill, set slightly inboard so the blue frame reads in front of it. Aim the
      // panel at a point straight out horizontally — using the midpoint itself as the
      // lookAt target tilts every panel by its own height, which hid the upper bays.
      const mid = new THREE.Vector3((lo0.x + lo1.x) / 2, (y + yTop) / 2, (lo0.z + lo1.z) / 2);
      const inboard = new THREE.Vector3(mid.x * 0.88, mid.y, mid.z * 0.88);
      const paneG = new THREE.PlaneGeometry(lo0.distanceTo(lo1) * 0.92, yTop - y);
      const pane = new THREE.Object3D();
      pane.position.copy(inboard);
      pane.lookAt(inboard.x * 4, inboard.y, inboard.z * 4);
      bake(panelParts, paneG, pane);
      // X bracing in front of the panel
      for (const [p, q] of [[lo0, hi1], [lo1, hi0]]) {
        const brG = new THREE.BoxGeometry(0.026, p.distanceTo(q), 0.026);
        const br = new THREE.Object3D();
        br.position.copy(p).add(q).multiplyScalar(0.5);
        br.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), q.clone().sub(p).normalize());
        bake(blueParts, brG, br);
      }
    }
  }

  for (const [parts, mat] of [[blueParts, blue], [panelParts, panel], [darkParts, blueDark]]) {
    if (!parts.length) continue;
    const merged = mergeGeometries(parts, false);
    if (merged) g.add(new THREE.Mesh(merged, mat));
    parts.forEach((p) => p.dispose());
  }

  // ---- the sphere, sitting just above the shaft ----
  const SPHERE_Y = TOP + SR * 0.72;
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(R_TOP * 1.12, R_TOP * 1.26, 0.10, LEGS * 2), steel);
  collar.position.y = TOP + 0.04; g.add(collar);
  const orb = new THREE.Mesh(new THREE.SphereGeometry(SR, 22, 16), gold);
  orb.position.y = SPHERE_Y; g.add(orb);
  const deckLip = new THREE.Mesh(new THREE.TorusGeometry(SR * 0.995, 0.016, 8, 26), steel);
  deckLip.position.y = SPHERE_Y - SR * 0.34; deckLip.rotation.x = Math.PI / 2; g.add(deckLip);
  const vis = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.05), glass);
  vis.position.set(0, SPHERE_Y - SR * 0.10, -SR * 0.995); vis.rotation.y = Math.PI; g.add(vis);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.16, 8), steel);
  mast.position.y = SPHERE_Y + SR + 0.06; g.add(mast);

  const { flame, f1, f2 } = makeFlame(1, 0.05); g.add(flame);
  const wing = makeWing(1.2); g.add(wing);
  [orb, vis, f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.parts = { flame, f1, f2, wing, visor: vis };
  return g;
}

/**
 * Nashville — a guitar, flown neck-first. Music City's one unmistakable object.
 * Original art, named for its place; no maker's headstock shape or logo is copied.
 *
 * Horizontal like the locomotive, for the same reason: a guitar is read from its
 * outline, and stood on end it is just a lumpy stick. userData.noseForward keeps Player
 * from leaning it nose-down into travel.
 */
export function buildGuitar() {
  const g = new THREE.Group();
  const burstMat = new THREE.MeshStandardMaterial({ color: 0xb4531c, roughness: 0.32, metalness: 0.12 });
  const edge = new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.4 });
  const board = new THREE.MeshStandardMaterial({ color: 0x2b1a10, roughness: 0.6 });
  const maple = new THREE.MeshStandardMaterial({ color: 0xd8b076, roughness: 0.5 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9b44a, roughness: 0.28, metalness: 0.75 });
  const string = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, roughness: 0.25, metalness: 0.8 });

  // ---- body outline: upper bout, waist, lower bout ----
  const body = new THREE.Shape();
  body.moveTo(0, 0.62);
  body.bezierCurveTo(0.34, 0.62, 0.46, 0.40, 0.42, 0.20);
  body.bezierCurveTo(0.39, 0.06, 0.30, 0.02, 0.30, -0.06);
  body.bezierCurveTo(0.30, -0.20, 0.52, -0.30, 0.52, -0.52);
  body.bezierCurveTo(0.52, -0.76, 0.30, -0.92, 0, -0.92);
  body.bezierCurveTo(-0.30, -0.92, -0.52, -0.76, -0.52, -0.52);
  body.bezierCurveTo(-0.52, -0.30, -0.30, -0.20, -0.30, -0.06);
  body.bezierCurveTo(-0.30, 0.02, -0.39, 0.06, -0.42, 0.20);
  body.bezierCurveTo(-0.46, 0.40, -0.34, 0.62, 0, 0.62);
  const bodyGeo = new THREE.ExtrudeGeometry(body, { depth: 0.16, bevelEnabled: true, bevelSize: 0.03, bevelThickness: 0.03, bevelSegments: 2, curveSegments: 14 });
  bodyGeo.center();
  const bodyMesh = new THREE.Mesh(bodyGeo, burstMat);
  bodyMesh.rotation.x = -Math.PI / 2;      // lay the outline flat, long axis along Z
  bodyMesh.position.set(0, 0.72, 0.52);
  g.add(bodyMesh);

  // sound hole + rosette
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.15, 24), edge);
  // the extruded body plus bevel is ~0.22 thick, so its top face sits near y=0.83 —
  // anything placed below that is buried inside the soundboard.
  hole.rotation.x = -Math.PI / 2; hole.position.set(0, 0.838, 0.40); g.add(hole);
  const rosette = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.014, 8, 28), gold);
  rosette.rotation.x = Math.PI / 2; rosette.position.set(0, 0.840, 0.40); g.add(rosette);

  // bridge + pickguard
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.05, 0.10), edge);
  bridge.position.set(0, 0.852, 0.92); g.add(bridge);
  for (let i = 0; i < 6; i++) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.045, 6), maple);
    pin.position.set(-0.125 + i * 0.05, 0.878, 0.92); g.add(pin);
  }

  // ---- neck, fretboard, frets ----
  const neck = new THREE.Mesh(new THREE.BoxGeometry(0.155, 0.09, 1.05), maple);
  neck.position.set(0, 0.755, -0.44); g.add(neck);
  const fb = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.028, 1.02), board);
  fb.position.set(0, 0.807, -0.45); g.add(fb);
  const fretParts = [];
  for (let i = 0; i < 12; i++) {
    const z = -0.02 - i * 0.078;
    const fg = new THREE.BoxGeometry(0.162, 0.012, 0.012);
    const o = new THREE.Object3D(); o.position.set(0, 0.822, z); o.updateMatrix();
    fretParts.push(fg.clone().applyMatrix4(o.matrix));
  }
  const frets = mergeGeometries(fretParts, false);
  if (frets) g.add(new THREE.Mesh(frets, gold));
  fretParts.forEach((f) => f.dispose());

  // ---- headstock ----
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.20, 0.05, 0.30), edge);
  head.position.set(0, 0.80, -1.10); head.rotation.x = 0.16; g.add(head);
  const pegParts = [];
  for (const sx of [-1, 1]) for (let i = 0; i < 3; i++) {
    const pg = new THREE.CylinderGeometry(0.018, 0.018, 0.05, 8);
    const o = new THREE.Object3D();
    o.position.set(sx * 0.115, 0.815, -1.02 - i * 0.075); o.rotation.z = Math.PI / 2; o.updateMatrix();
    pegParts.push(pg.clone().applyMatrix4(o.matrix));
  }
  const pegs = mergeGeometries(pegParts, false);
  if (pegs) g.add(new THREE.Mesh(pegs, gold));
  pegParts.forEach((p) => p.dispose());

  // ---- strings, bridge to nut, merged ----
  const strParts = [];
  for (let i = 0; i < 6; i++) {
    const x = -0.065 + i * 0.026;
    const sg = new THREE.BoxGeometry(0.008, 0.008, 2.02);
    const o = new THREE.Object3D(); o.position.set(x, 0.856, -0.05); o.updateMatrix();
    strParts.push(sg.clone().applyMatrix4(o.matrix));
  }
  const strings = mergeGeometries(strParts, false);
  if (strings) g.add(new THREE.Mesh(strings, string));
  strParts.forEach((p) => p.dispose());

  // exhaust out the tail of the body
  const { flame, f1, f2 } = makeFlame(1, 0);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, 0.78, 1.30); g.add(flame);
  const wing = makeWing(1.05); g.add(wing);
  [f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.noseForward = true;
  g.userData.parts = { flame, f1, f2, wing, visor: hole };
  return g;
}

/** Citrus peel: warm orange with the pitted texture a real rind has. */
function orangePeelTexture({ w = 512, h = 256 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#ffb03a'); grad.addColorStop(0.5, '#f79020'); grad.addColorStop(1, '#d4700f');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // pitting — deterministic, so the rind looks the same every build
  let seed = 7;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 2600; i++) {
    const x = rnd() * w, y = rnd() * h, r = 0.7 + rnd() * 1.7;
    g.fillStyle = rnd() > 0.5 ? 'rgba(140,70,10,0.30)' : 'rgba(255,214,140,0.28)';
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

/**
 * Orlando — a flying orange. Orange County is named for the citrus that built the place
 * and carries it on its seal, so this is the local thing that is nobody's trademark, which
 * matters in a city where most of the landmarks are.
 *
 * Upright, and deliberately the one round silhouette in the roster: against a rocket, a
 * locomotive, a lattice tower and a guitar, a sphere reads instantly at any distance.
 */
export function buildOrange() {
  const g = new THREE.Group();
  const peel = new THREE.MeshStandardMaterial({ map: orangePeelTexture(), roughness: 0.72, metalness: 0.02 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x3f9a3a, roughness: 0.6, side: THREE.DoubleSide });
  const stalk = new THREE.MeshStandardMaterial({ color: 0x6b4a1e, roughness: 0.8 });
  const gloss = new THREE.MeshStandardMaterial({
    color: 0xfff2c8, roughness: 0.12, metalness: 0.1, transparent: true, opacity: 0.5,
  });

  const R = 0.78;
  const body = new THREE.Mesh(new THREE.SphereGeometry(R, 28, 20), peel);
  body.scale.set(1, 0.93, 1);            // real oranges are a touch oblate
  body.position.y = R * 0.95; g.add(body);

  // navel dimple at the top, where the stalk sits
  const dimple = new THREE.Mesh(new THREE.SphereGeometry(R * 0.17, 14, 10), stalk);
  dimple.position.y = R * 1.78; dimple.scale.y = 0.45; g.add(dimple);
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.20, 8), stalk);
  stem.position.y = R * 1.90; g.add(stem);

  // two leaves, angled apart so the top reads as citrus rather than a beach ball
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(0.16, 0.10, 0.30, 0.26, 0.40, 0.02);
    shape.bezierCurveTo(0.30, -0.10, 0.16, -0.06, 0, 0);
    const leaf = new THREE.Mesh(new THREE.ShapeGeometry(shape, 12), leafMat);
    leaf.position.set(sx * 0.04, R * 1.99, 0);
    leaf.rotation.set(-0.9, 0, sx > 0 ? 0.25 : Math.PI - 0.25);
    g.add(leaf);
  }

  // a soft specular patch, doubling as the parts.visor the camera contract expects
  const vis = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), gloss);
  vis.position.set(-0.22, R * 1.28, -R * 0.86); vis.rotation.set(0.25, Math.PI + 0.3, 0);
  g.add(vis);

  const { flame, f1, f2 } = makeFlame(1, 0.02); g.add(flame);
  const wing = makeWing(1.05); g.add(wing);
  [body, vis, f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.parts = { flame, f1, f2, wing, visor: vis };
  return g;
}

/**
 * Miami — a flamingo. Unmistakably South Florida, and the only flyer in the roster that
 * is a thing which actually flies: neck stretched forward, legs trailing, wings out.
 *
 * Horizontal and noseForward, like the locomotive and the guitar — a flamingo in flight is
 * read entirely from its outline, and stood on end it is a pink stick.
 */
export function buildFlamingo() {
  const g = new THREE.Group();
  const pink = new THREE.MeshStandardMaterial({ color: 0xf7568f, roughness: 0.62 });
  const pinkDeep = new THREE.MeshStandardMaterial({ color: 0xd8336f, roughness: 0.6, side: THREE.DoubleSide });
  const pinkPale = new THREE.MeshStandardMaterial({ color: 0xffa8c8, roughness: 0.66 });
  const beakMat = new THREE.MeshStandardMaterial({ color: 0xf4d9a0, roughness: 0.5 });
  const blackTip = new THREE.MeshStandardMaterial({ color: 0x1a1216, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, roughness: 0.2, emissive: 0x332a10, emissiveIntensity: 0.5 });

  const Y = 0.92;                         // flight height of the body centre

  // ---- body: an ellipsoid, tail tapering aft ----
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.30, 22, 16), pink);
  body.scale.set(1.05, 1.0, 1.72); body.position.set(0, Y, 0.10); g.add(body);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 14), pink);
  tail.rotation.x = -Math.PI / 2; tail.position.set(0, Y + 0.03, 0.62); g.add(tail);

  // ---- neck: one swept tube, not a row of spheres ----
  // Spaced spheres left visible gaps and read as a string of beads; a tube along the same
  // curve gives the continuous S-bend that actually says flamingo.
  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, Y + 0.02, -0.22),
    new THREE.Vector3(0, Y + 0.14, -0.48),
    new THREE.Vector3(0, Y + 0.24, -0.76),
    new THREE.Vector3(0, Y + 0.29, -1.04),
    new THREE.Vector3(0, Y + 0.27, -1.24),
  ]);
  const neck = new THREE.Mesh(new THREE.TubeGeometry(neckCurve, 28, 0.072, 10, false), pink);
  g.add(neck);

  // ---- head + the down-kinked beak ----
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 14, 12), pink);
  head.position.set(0, Y + 0.25, -1.30); g.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.058, 0.26, 12), beakMat);
  beak.position.set(0, Y + 0.20, -1.44); beak.rotation.x = -2.0; g.add(beak);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.036, 0.10, 12), blackTip);
  tip.position.set(0, Y + 0.12, -1.53); tip.rotation.x = -2.0; g.add(tip);
  for (const sx of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 8), eyeMat);
    eye.position.set(sx * 0.072, Y + 0.29, -1.34); g.add(eye);
  }

  // ---- wings: broad, swept, and raised into a dihedral ----
  // Flat horizontal blades disappeared head-on; angling them up gives the bird a
  // recognisable outline from the front as well as from above, and black primaries at the
  // trailing edge are the detail that reads as a flamingo rather than a pink gull.
  for (const sx of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0.22);
    shape.bezierCurveTo(0.42, 0.24, 0.92, 0.06, 1.24, -0.16);
    shape.bezierCurveTo(0.86, -0.30, 0.40, -0.30, 0, -0.20);
    shape.lineTo(0, 0.22);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.05, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 1, curveSegments: 12 });
    // Wing and its primaries share one group, so the tip feathers inherit the sweep and the
    // droop instead of floating beside a wing that has been rotated out from under them.
    const wingGrp = new THREE.Group();
    const w = new THREE.Mesh(geo, pinkDeep);
    w.rotation.x = -Math.PI / 2;
    w.scale.x = sx;
    wingGrp.add(w);
    const prim = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.035, 0.20), blackTip);
    prim.position.set(sx * 0.92, 0.005, 0.02);
    wingGrp.add(prim);
    wingGrp.position.set(sx * 0.18, Y + 0.07, 0.02);
    wingGrp.rotation.y = sx * -0.12;                                  // sweep back
    wingGrp.rotateOnWorldAxis(new THREE.Vector3(0, 0, 1), sx * -0.26); // mid-downstroke droop
    g.add(wingGrp);
  }

  // ---- legs trailing straight back, the other half of the silhouette ----
  const legParts = [];
  for (const sx of [-1, 1]) {
    const leg = new THREE.CylinderGeometry(0.022, 0.018, 0.92, 7);
    const o = new THREE.Object3D();
    o.position.set(sx * 0.09, Y - 0.06, 0.98); o.rotation.x = Math.PI / 2 - 0.06; o.updateMatrix();
    legParts.push(leg.clone().applyMatrix4(o.matrix));
    const foot = new THREE.BoxGeometry(0.10, 0.02, 0.12);
    const f = new THREE.Object3D(); f.position.set(sx * 0.09, Y - 0.09, 1.44); f.updateMatrix();
    legParts.push(foot.clone().applyMatrix4(f.matrix));
  }
  const legs = mergeGeometries(legParts, false);
  if (legs) g.add(new THREE.Mesh(legs, pinkPale));
  legParts.forEach((l) => l.dispose());

  const { flame, f1, f2 } = makeFlame(0.85, 0);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, Y + 0.02, 1.05); g.add(flame);
  const wing = makeWing(1.15); g.add(wing);
  [body, f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.noseForward = true;
  g.userData.parts = { flame, f1, f2, wing, visor: head };
  return g;
}

/** Broom handle: pale ash with a straight, slightly uneven grain. */
function broomWoodTexture({ w = 256, h = 256 } = {}) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#b4854a'); grad.addColorStop(0.5, '#9a6c38'); grad.addColorStop(1, '#7d5528');
  g.fillStyle = grad; g.fillRect(0, 0, w, h);
  // grain runs the length of the handle; deterministic so every build looks the same
  let seed = 19;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 90; i++) {
    const x = rnd() * w;
    g.strokeStyle = `rgba(60,38,16,${0.06 + rnd() * 0.14})`;
    g.lineWidth = 0.5 + rnd() * 1.6;
    g.beginPath(); g.moveTo(x, 0);
    g.bezierCurveTo(x + (rnd() - 0.5) * 12, h * 0.35, x + (rnd() - 0.5) * 12, h * 0.7, x + (rnd() - 0.5) * 8, h);
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.anisotropy = 4;
  return tex;
}

/**
 * Orlando — a flying broom. Folklore older than any theme park and owned by nobody,
 * which is precisely why this exists and a pair of mouse ears does not: the silhouette
 * is public domain, the art is original, and nothing here copies a maker's shape.
 *
 * Horizontal and noseForward, like the guitar and the locomotive. The bristles trail
 * at the tail with the exhaust burning through them, so the outline reads as motion
 * even parked on the ground.
 */
export function buildBroomstick() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ map: broomWoodTexture(), roughness: 0.78, metalness: 0.03 });
  const cordMat = new THREE.MeshStandardMaterial({ color: 0x7a4a22, roughness: 0.88 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a227, roughness: 0.26, metalness: 0.85 });
  const strawMat = new THREE.MeshStandardMaterial({ color: 0xc2933f, roughness: 0.9 });

  const Y = 0.95;                          // ride height: where a seated rider's grip would sit

  // Shaft runs nose(-Z) to tail(+Z), tapering thinner toward the nose like a real handle.
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.048, 2.55, 12).rotateX(Math.PI / 2), wood);
  shaft.position.set(0, Y, 0.18); g.add(shaft);

  // Brass ferrule at the nose, doubling as the reflective parts.visor the camera wants.
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), brass);
  cap.position.set(0, Y, -1.12); cap.scale.z = 1.5; g.add(cap);

  // Waxed cord binding where the bristles are lashed on — two wraps, slightly apart.
  for (const z of [1.16, 1.34]) {
    const wrap = new THREE.Mesh(new THREE.CylinderGeometry(0.098, 0.098, 0.075, 12).rotateX(Math.PI / 2), cordMat);
    wrap.position.set(0, Y, z); g.add(wrap);
  }

  // Foot pegs, so it reads as ridden rather than thrown.
  for (const sx of [-1, 1]) {
    const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.022, 0.30, 8).rotateZ(Math.PI / 2), wood);
    peg.position.set(sx * 0.17, Y - 0.03, 0.72); g.add(peg);
  }

  // Bristles: ~34 tapered straws splayed into a cone. Merged into one mesh — the guitar
  // strings take the same approach, and 34 separate draw calls per broom is not worth it.
  const parts = [];
  const bg = new THREE.ConeGeometry(0.028, 0.95, 5).rotateX(Math.PI / 2);
  const o = new THREE.Object3D();
  let seed = 5;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  for (let i = 0; i < 34; i++) {
    const a = (i / 34) * Math.PI * 2 + rnd() * 0.16;
    const r = 0.045 + rnd() * 0.055;                 // bundled tight at the lashing
    const spread = 0.16 + rnd() * 0.24;              // and fanning out toward the ends
    o.position.set(Math.cos(a) * r, Y + Math.sin(a) * r, 1.42 + rnd() * 0.06);
    o.rotation.set(-Math.sin(a) * spread, Math.cos(a) * spread, 0);
    o.scale.setScalar(0.85 + rnd() * 0.3);
    o.updateMatrix();
    parts.push(bg.clone().applyMatrix4(o.matrix));
  }
  const bristles = mergeGeometries(parts, false);
  if (bristles) g.add(new THREE.Mesh(bristles, strawMat));
  parts.forEach((p) => p.dispose());
  bg.dispose();

  // Exhaust burns out through the middle of the bristle bundle.
  const { flame, f1, f2 } = makeFlame(0.8, 0);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, Y, 2.05); g.add(flame);
  const wing = makeWing(Y + 0.12); g.add(wing);
  [cap, f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.noseForward = true;
  g.userData.parts = { flame, f1, f2, wing, visor: cap };
  return g;
}

/**
 * Orlando — a star-tipped wand, flown star-first. A five-point star on a tapered shaft
 * is a generic shape with no owner; no character, crest or maker's mark appears on it.
 *
 * Horizontal and noseForward. The exhaust is recoloured violet-white so it trails as
 * sparks rather than rocket flame — makeFlame builds fresh materials per call, so
 * tinting them here cannot leak into any other character.
 */
export function buildStarWand() {
  const g = new THREE.Group();
  const lacquer = new THREE.MeshStandardMaterial({ color: 0x241a3a, roughness: 0.3, metalness: 0.2 });
  const gold = new THREE.MeshStandardMaterial({
    color: 0xf3c73e, roughness: 0.22, metalness: 0.9, emissive: 0x6b4c00, emissiveIntensity: 0.55,
  });
  const gripMat = new THREE.MeshStandardMaterial({ color: 0x4a2f6b, roughness: 0.82 });
  const gemMat = new THREE.MeshStandardMaterial({
    color: 0xbfe6ff, roughness: 0.08, metalness: 0.35,
    emissive: 0x2a6fa8, emissiveIntensity: 0.7, transparent: true, opacity: 0.85,
  });

  const Y = 0.95;

  // Shaft: thick at the grip (+Z), tapering to the star (-Z).
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.062, 0.032, 2.0, 12).rotateX(Math.PI / 2), lacquer);
  shaft.position.set(0, Y, 0.35); g.add(shaft);

  // Wrapped grip at the tail — six raised rings, so it reads as held.
  for (let i = 0; i < 6; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.052, 0.014, 8, 14), gripMat);
    ring.position.set(0, Y, 0.98 + i * 0.072); g.add(ring);
  }
  // Gold collars top and tail the grip.
  for (const [z, r] of [[0.30, 0.046], [1.40, 0.058]]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.05, 14).rotateX(Math.PI / 2), gold);
    band.position.set(0, Y, z); g.add(band);
  }

  // Five-point star at the nose, in the XY plane so the camera behind reads it face-on.
  const star = new THREE.Shape();
  const R = 0.40, r2 = 0.165;
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r2 : R;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;   // one point straight up
    const x = Math.cos(a) * rad, y = Math.sin(a) * rad;
    if (i === 0) star.moveTo(x, y); else star.lineTo(x, y);
  }
  star.closePath();
  const starGeo = new THREE.ExtrudeGeometry(star, {
    depth: 0.06, bevelEnabled: true, bevelThickness: 0.022, bevelSize: 0.022, bevelSegments: 2,
  });
  starGeo.center();
  const starMesh = new THREE.Mesh(starGeo, gold);
  starMesh.position.set(0, Y, -0.72); g.add(starMesh);

  // Gem at the star's heart — the reflective highlight parts.visor expects.
  const gem = new THREE.Mesh(new THREE.OctahedronGeometry(0.088, 0), gemMat);
  gem.position.set(0, Y, -0.78); g.add(gem);

  const { flame, f1, f2 } = makeFlame(0.4, 0);
  f1.material.color.set(0x9b7bff); f2.material.color.set(0xfff4c2);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, Y, 1.62); g.add(flame);
  const wing = makeWing(Y + 0.12); g.add(wing);
  [starMesh, gem, f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.noseForward = true;
  g.userData.parts = { flame, f1, f2, wing, visor: gem };
  return g;
}

/**
 * Anaheim — a surfboard. Southern California in one silhouette, and a shape nobody owns:
 * no brand, no logo, no maker's outline is copied. Flown nose-first like the guitar and
 * the broom, because a board stood on end is just a plank.
 */
export function buildSurfboard() {
  const g = new THREE.Group();
  const deck = new THREE.MeshStandardMaterial({ color: 0xfdf3dc, roughness: 0.42, metalness: 0.04 });
  const rail = new THREE.MeshStandardMaterial({ color: 0xe8d9b4, roughness: 0.5 });
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xff6b3d, roughness: 0.35 });
  const finMat = new THREE.MeshStandardMaterial({ color: 0x1f6f8b, roughness: 0.34, metalness: 0.1 });
  const waxMat = new THREE.MeshStandardMaterial({
    color: 0xfffbe8, roughness: 0.15, metalness: 0.05, transparent: true, opacity: 0.55,
  });

  const Y = 0.95;              // ride height
  const L = 2.6, W = 0.56;     // length, widest beam

  // Outline: pointed nose, widest just aft of centre, tail pulled in. Drawn in XY and laid
  // flat, so the extrusion depth becomes the board's thickness.
  const half = (sign) => {
    const s = new THREE.Shape();
    s.moveTo(0, -L / 2);                                             // nose
    s.bezierCurveTo(sign * W * 0.30, -L * 0.30, sign * W * 0.50, L * 0.02, sign * W * 0.50, L * 0.12);
    s.bezierCurveTo(sign * W * 0.50, L * 0.30, sign * W * 0.22, L * 0.44, 0, L / 2);  // tail
    return s;
  };
  for (const sign of [1, -1]) {
    const geo = new THREE.ExtrudeGeometry(half(sign), {
      depth: 0.085, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.028, bevelSegments: 2,
    });
    geo.rotateX(-Math.PI / 2);                                       // lay it flat: length -> Z
    const m = new THREE.Mesh(geo, sign > 0 ? deck : rail);
    m.position.set(0, Y, 0);
    g.add(m);
  }

  // Centre stringer, nose to tail
  // Deck surface sits at depth(0.085) + bevel(0.03); anything lower is inside the foam.
  const DECK = Y + 0.118;
  const stringer = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.016, L * 0.92), stripeMat);
  stringer.position.set(0, DECK, 0); g.add(stringer);
  // Two sunset bands across the deck
  for (const z of [L * 0.14, L * 0.24]) {
    const band = new THREE.Mesh(new THREE.BoxGeometry(W * 0.80, 0.014, 0.13), stripeMat);
    band.position.set(0, DECK, z); g.add(band);
  }

  // Single fin under the tail
  const fin = new THREE.Shape();
  fin.moveTo(0, 0); fin.quadraticCurveTo(0.10, -0.16, 0.30, -0.34); fin.lineTo(0.06, -0.30); fin.closePath();
  const finGeo = new THREE.ExtrudeGeometry(fin, { depth: 0.03, bevelEnabled: false });
  finGeo.rotateY(Math.PI / 2);
  const finMesh = new THREE.Mesh(finGeo, finMat);
  finMesh.position.set(0, Y, L * 0.40); g.add(finMesh);

  // Waxed patch: the reflective highlight the camera contract wants for parts.visor
  const wax = new THREE.Mesh(new THREE.CircleGeometry(0.17, 20), waxMat);
  wax.rotation.x = -Math.PI / 2;
  wax.position.set(0, DECK + 0.004, L * 0.02); g.add(wax);

  // Spray off the tail rather than a rocket plume
  const { flame, f1, f2 } = makeFlame(0.55, 0);
  f1.material.color.set(0x8fdcff); f2.material.color.set(0xffffff);
  flame.rotation.x = -Math.PI / 2;
  flame.position.set(0, Y, L * 0.56); g.add(flame);
  const wing = makeWing(Y + 0.14); g.add(wing);
  [wax, f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.noseForward = true;
  g.userData.parts = { flame, f1, f2, wing, visor: wax };
  return g;
}

/**
 * Statue of Liberty — New York City.
 *
 * The torch IS the thruster. Every other character has exhaust bolted on:
 * makeFlame points its cones downward for a rocket, and the Choo Choo already
 * established that a flame can fire elsewhere so long as parts.flame still just
 * toggles .visible. Here the flame group is flipped upright and seated in the
 * torch bowl, so the statue's own defining feature lights when she flies and
 * dies when she glides. Nothing in Player or remotes needs to know.
 *
 * Verdigris, not copper: she has been green since about 1920, and green reads
 * against both the sky and Manhattan's grey far better than brown would.
 * Forward is -Z, matching the others; the torch arm is her right.
 */
export function buildLiberty() {
  const g = new THREE.Group();
  const green = new THREE.MeshStandardMaterial({ color: 0x5aa88c, roughness: 0.62 });
  const shade = new THREE.MeshStandardMaterial({ color: 0x3d7d67, roughness: 0.68 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.3, metalness: 0.75 });

  // Robe: a wide skirt tapering to the waist, with two fold ridges so the silhouette
  // is not a plain cone at the distance these are actually seen from.
  const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.30, 0.54, 1.18, 20), green);
  robe.position.y = 0.59; g.add(robe);
  for (const a of [-0.5, 0.45]) {
    const fold = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 1.1, 6), shade);
    fold.position.set(Math.sin(a) * 0.34, 0.58, Math.cos(a) * -0.34); g.add(fold);
  }
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.30, 0.36, 18), green);
  torso.position.y = 1.34; g.add(torso);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(0.245, 16, 12), green);
  shoulders.position.y = 1.50; shoulders.scale.set(1, 0.62, 0.86); g.add(shoulders);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.155, 20, 16), green);
  head.position.y = 1.74; head.scale.set(0.92, 1.06, 0.96); g.add(head);
  // Stands in for the contract's `visor`. Nothing outside characters.js reads it,
  // but the shape is the face, so it is the honest thing to hand over.
  const face = new THREE.Mesh(new THREE.CircleGeometry(0.075, 18), shade);
  face.position.set(0, 1.75, -0.145); g.add(face);

  // Seven spikes, one per continent, swept round the front where they read.
  for (let i = 0; i < 7; i++) {
    const a = -Math.PI * 0.82 + (i / 6) * Math.PI * 1.64;
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.032, 0.30, 6), green);
    spike.position.set(Math.sin(a) * 0.17, 1.86, Math.cos(a) * -0.17);
    spike.rotation.set(Math.cos(a) * -0.55, 0, Math.sin(a) * -0.55);
    g.add(spike);
  }

  // Raised right arm: shoulder (0.20, 1.45) to hand (0.34, 2.05).
  const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.62, 12), green);
  arm.position.set(0.27, 1.75, 0); arm.rotation.z = -0.23; g.add(arm);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.16, 10), gold);
  handle.position.set(0.34, 2.09, 0); g.add(handle);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.105, 0.055, 0.10, 14), gold);
  bowl.position.set(0.34, 2.20, 0); g.add(bowl);

  // Left arm down across the body, holding the tablet.
  const armL = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.52, 12), green);
  armL.position.set(-0.22, 1.28, -0.06); armL.rotation.z = 0.22; g.add(armL);
  const tablet = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.40, 0.07), green);
  tablet.position.set(-0.28, 1.10, -0.16); tablet.rotation.set(0.30, 0, 0.28); g.add(tablet);
  const engraved = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.30, 0.01), shade);
  engraved.position.set(-0.30, 1.11, -0.19); engraved.rotation.copy(tablet.rotation); g.add(engraved);

  // The flame, flipped upright and seated in the bowl. makeFlame builds it pointing
  // down for a rocket; rotating the group is all that separates thrust from a torch.
  const { flame, f1, f2 } = makeFlame(0.4);
  flame.rotation.x = Math.PI;
  flame.position.set(0.34, 2.26, 0);
  g.add(flame);

  const wing = makeWing(1.34); g.add(wing);
  // The torch must stay gold and the flame must stay fire-coloured when a remote
  // player is tinted to their own colour.
  [handle, bowl, f1, f2].forEach((m) => { m.userData.noTint = true; });
  g.userData.parts = { flame, f1, f2, wing, visor: face, armL, armR: arm };
  return g;
}

export const CHARACTERS = {
  saturn: { name: 'SATURN V', build: buildSaturnV },
  panda: { name: 'TRASH PANDA', build: buildTrashPanda },
  astro: { name: 'ASTRONAUT', build: buildAstronaut },
  ufo: { name: 'UFO', build: buildUFO },
  choochoo: { name: 'CHOO CHOO', build: buildChooChoo },
  sunsphere: { name: 'SUNSPHERE', build: buildSunsphere },
  guitar: { name: 'GUITAR', build: buildGuitar },
  orange: { name: 'ORANGE', build: buildOrange },
  flamingo: { name: 'FLAMINGO', build: buildFlamingo },
  broomstick: { name: 'BROOMSTICK', build: buildBroomstick },
  wand: { name: 'STAR WAND', build: buildStarWand },
  surfboard: { name: 'SURFBOARD', build: buildSurfboard },
  liberty: { name: 'LIBERTY', build: buildLiberty },
};
export const CHARACTER_KEYS = Object.keys(CHARACTERS);
