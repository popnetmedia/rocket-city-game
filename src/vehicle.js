import * as THREE from 'three';

// Arcade car: hand-rolled, no physics engine.
const MAX_SPEED = 38;        // m/s (~85 mph)
const MAX_REVERSE = 8;
const ACCEL = 12;            // m/s^2
const BRAKE = 22;
const DRAG = 0.6;            // proportional drag
const ROLL = 2.5;            // rolling resistance m/s^2
const STEER_MAX = 0.75;      // rad at low speed
const WHEELBASE = 2.6;

/**
 * Half-extents of the body box built below, in metres. Lives here so anything
 * needing a car's ground footprint -- contact shadows -- cannot drift from the
 * geometry buildCar actually makes.
 */
export const CAR_HALF = { w: 0.95, d: 2.1 };

export function buildCar(color = 0xff3b1f) {
  const g = new THREE.Group();
  const paint = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.4 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd8ff, roughness: 0.1, metalness: 0.6, transparent: true, opacity: 0.85 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.95 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.2, metalness: 0.9 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.55, 4.2), paint);
  body.position.y = 0.55; g.add(body);
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.5, 2.0), glass);
  cabin.position.set(0, 1.05, -0.2); g.add(cabin);
  const bumper = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.18, 0.2), chrome);
  bumper.position.set(0, 0.35, 2.15); g.add(bumper);
  const headL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.15, 0.05), new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xfff2a0, emissiveIntensity: 1.2 }));
  headL.position.set(-0.65, 0.65, 2.11); const headR = headL.clone(); headR.position.x = 0.65; g.add(headL, headR);

  const wheelGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  [[-0.95, 1.35], [0.95, 1.35], [-0.95, -1.35], [0.95, -1.35]].forEach(([x, z], i) => {
    const pivot = new THREE.Group();
    pivot.position.set(x, 0.36, z);
    const w = new THREE.Mesh(wheelGeo, rubber);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 12).rotateZ(Math.PI / 2), chrome);
    pivot.add(w, hub);
    g.add(pivot);
    wheels.push({ pivot, mesh: w, hub, front: i < 2 });
  });
  g.userData.wheels = wheels;
  return g;
}

export class Vehicle {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.mesh = null;   // the Car's mesh while driving
    this.car = null;

    this.position = new THREE.Vector3();
    this.heading = 0;   // yaw
    this.speed = 0;     // signed m/s (forward +)
    this.steer = 0;
    this.active = false;
    this.vy = 0;
    this.vel = new THREE.Vector3(); // world-space horizontal velocity (for drift)
    this.drift = 0;                  // 0..1 how much the rear is sliding
    this._tmp = new THREE.Vector3();
    this._n = new THREE.Vector3();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._spin = 0;
  }

  /** Take the wheel of a world Car. */
  enter(car) {
    this.car = car; car.driver = 'player';
    this.mesh = car.mesh;
    this.position.copy(car.position);
    this.heading = car.heading;
    this.maxSpeed = car.kind?.maxSpeed ?? MAX_SPEED;
    this.speed = 0; this.steer = 0; this.vy = 0; this.drift = 0; this.vel.set(0, 0, 0);
    this.active = true;
  }

  /** Step out; the car stays where it is. */
  exit() {
    if (this.car) { this.car.position.copy(this.position); this.car.heading = this.heading; this.car.driver = null; }
    this.active = false;
    this.car = null; this.mesh = null;
  }

  get speedMps() { return Math.abs(this.speed); }

  update(dt, input) {
    if (!this.active) return;

    // ---- controls ----
    const axis = input.moveAxis();
    const throttle = axis.y;
    const steerIn = -axis.x;
    const handbrake = input.down('Space');

    // steering: reduce lock at speed for stability
    const lock = STEER_MAX / (1 + this.speedMps / 12);
    const target = steerIn * lock;
    this.steer += (target - this.steer) * Math.min(1, 8 * dt);

    // longitudinal
    if (throttle > 0) {
      this.speed += (this.speed < 0 ? BRAKE : ACCEL) * dt;
    } else if (throttle < 0) {
      this.speed -= (this.speed > 0 ? BRAKE : ACCEL * 0.6) * dt;
    }
    // Handbrake: locks the rears -> mild drift. Speed scrubs off gently; the car keeps sliding
    // along its previous velocity while the nose rotates faster than usual.
    if (handbrake) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), BRAKE * 0.55 * dt);
    const wantDrift = handbrake && this.speedMps > 6 ? 1 : 0;
    this.drift += (wantDrift - this.drift) * Math.min(1, (wantDrift ? 6 : 2.5) * dt);
    // drag + rolling resistance
    this.speed -= this.speed * DRAG * dt;
    this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), ROLL * dt);
    this.speed = THREE.MathUtils.clamp(this.speed, -MAX_REVERSE, this.maxSpeed ?? MAX_SPEED);

    // bicycle-model yaw rate (handbrake lets the nose swing ~1.8x faster)
    if (Math.abs(this.speed) > 0.05) {
      const yawRate = (this.speed / WHEELBASE) * Math.tan(this.steer) * (1 + this.drift * 0.8);
      this.heading += yawRate * dt;
    }

    // integrate horizontal: velocity is blended between "where the nose points" (full grip)
    // and "where we were already going" (sliding). grip is lower while drifting.
    const fx = -Math.sin(this.heading), fz = -Math.cos(this.heading);
    const grip = 1 - this.drift * 0.7;
    const k = Math.min(1, (grip * 14 + 1) * dt);
    this.vel.x += (fx * this.speed - this.vel.x) * k;
    this.vel.z += (fz * this.speed - this.vel.z) * k;
    this.position.x += this.vel.x * dt;
    this.position.z += this.vel.z * dt;

    // ---- ground follow ----
    const probe = this._tmp.copy(this.position); probe.y += 3;
    let hit = this.world.groundBelow(probe, 400);
    if (!hit) { // under a popped-up tile? look higher and climb back onto the surface
      probe.copy(this.position); probe.y += 80;
      const rec = this.world.groundBelow(probe, 85);
      if (rec && rec.point.y >= this.position.y - 0.05) { this.position.y = rec.point.y; this.vy = 0; hit = rec; }
    }
    if (hit) {
      const gy = hit.point.y;
      if (this.position.y <= gy + 0.05 || (gy - this.position.y <= 3 && gy > this.position.y)) {
        this.position.y = gy; this.vy = 0;
      } else {
        this.vy -= 18 * dt; this.position.y += this.vy * dt;
        if (this.position.y < gy) { this.position.y = gy; this.vy = 0; }
      }
      // tilt to surface normal (smoothed)
      if (hit.face) {
        this._n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
        if (this._n.y < 0.5) this._n.set(0, 1, 0);
      } else this._n.set(0, 1, 0);
    } else {
      this.vy = Math.max(this.vy - 18 * dt, -3);
      this.position.y += this.vy * dt;
      this._n.set(0, 1, 0);
    }

    // ---- visuals ----
    this.mesh.position.copy(this.position);
    const yawQ = new THREE.Quaternion().setFromAxisAngle(this._up, this.heading);
    const tiltQ = new THREE.Quaternion().setFromUnitVectors(this._up, this._n);
    this._q.multiplyQuaternions(tiltQ, yawQ);
    this.mesh.quaternion.slerp(this._q, Math.min(1, 10 * dt));

    this._spin += this.speed * dt / 0.36;
    for (const w of this.mesh.userData.wheels) {
      w.pivot.rotation.y = w.front ? this.steer : 0;
      w.mesh.rotation.x = this._spin; w.hub.rotation.x = this._spin;
    }
  }
}
