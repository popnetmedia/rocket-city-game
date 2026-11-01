import * as THREE from 'three';

/**
 * Stand-in city used only when no Map Tiles key is configured.
 * Returns a Group; the World raycasts against it exactly as it would
 * against the tile meshes (same groundBelow() code path).
 */
export function buildDevWorld() {
  const g = new THREE.Group();
  g.name = 'DevWorld';

  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(60000, 60000, 1, 1), // big enough that every Huntsville preset lands on it
    new THREE.MeshStandardMaterial({ color: 0x1b2a22, roughness: 1 }),
  );
  ground.rotation.x = -Math.PI / 2;
  g.add(ground);

  const grid = new THREE.GridHelper(1600, 80, 0x2f7d55, 0x14331f);
  grid.position.y = 0.02;
  grid.raycast = () => {}; // visual only
  g.add(grid);

  // Deterministic pseudo-random so the layout is stable between reloads.
  let seed = 1337;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  const boxMat = new THREE.MeshStandardMaterial({ color: 0x6c7379, roughness: 0.85 });
  const boxMatDark = new THREE.MeshStandardMaterial({ color: 0x4d5459, roughness: 0.85 });
  const N = 36;
  for (let i = 0; i < N; i++) {
    const w = 6 + rnd() * 18, d = 6 + rnd() * 18, h = 4 + rnd() * rnd() * 60;
    // ring layout around the origin, keep a 14 m clear spawn radius
    let x, z;
    do {
      const ang = (i / N) * Math.PI * 2 + rnd() * 0.3;
      const r = 45 + rnd() * 150;
      x = Math.cos(ang) * r; z = Math.sin(ang) * r;
      // keep the spawn clearing (r<45 incl. box half-size) and the ramp lane (x±14, z -90..-10) empty
    } while (Math.abs(x) < 14 && z < -10 && z > -90);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), i % 3 ? boxMat : boxMatDark);
    m.position.set(x, h / 2, z);
    m.rotation.y = rnd() * Math.PI;
    g.add(m);
  }

  // Ramp: 30 m long, 8 m wide, rising to 6 m — good for launching the glider/car.
  const rampGeo = new THREE.BoxGeometry(8, 0.5, 30);
  const ramp = new THREE.Mesh(rampGeo, new THREE.MeshStandardMaterial({ color: 0xb3541e, roughness: 0.7 }));
  const rise = 6, len = 30;
  ramp.rotation.x = Math.atan2(rise, len); // low end toward spawn (+Z), high end at -Z
  ramp.position.set(0, rise / 2, -40);
  g.add(ramp);
  // landing platform at the top so you can stand there
  const top = new THREE.Mesh(new THREE.BoxGeometry(8, 0.5, 6), ramp.material);
  top.position.set(0, rise - 0.25, -40 - len / 2 - 3);
  g.add(top);

  return g;
}
