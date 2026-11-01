/**
 * Interior geometry: where the player stands, and what stops them.
 *
 * Deliberately free of three.js so it unit-tests in node: every function takes
 * anything with numeric `x` and `z`, which includes THREE.Vector3, and mutates
 * it in place. Outdoor movement is untouched — the player still has no wall
 * collision anywhere else, and that stays true.
 */

/** Half-width of the player's footprint, in metres. */
export const PLAYER_RADIUS = 0.45;

/**
 * Where the player should stand just inside a door, and which way they should
 * face, given the door's outward compass bearing and how far in from the wall
 * to stand.
 *
 * `facingDeg` is the door's outward compass bearing. Scene axes put north at
 * -z and east at +x (src/minimap.js:5), so a bearing t points along
 * (sin t, -cos t), and the door sits that way from the room centre.
 *
 * Player yaw is NOT that bearing. Forward is (-sin yaw, -cos yaw)
 * (src/player.js:268), so yaw runs anticlockwise where a bearing runs
 * clockwise, and facing back into the room works out to yaw = PI - t. Check
 * it against a door facing south (t = 180): the player stands on the south
 * side of the room looking north, which is yaw 0.
 *
 * Plain `Math.PI / 180` rather than THREE.MathUtils.degToRad — this file has
 * no three.js dependency, and that is what keeps it importable in node.
 */
export function doorAnchor(facingDeg, inset) {
  const t = ((facingDeg ?? 0) * Math.PI) / 180;
  return {
    dx: Math.sin(t) * inset,
    dz: -Math.cos(t) * inset,
    yaw: Math.PI - t,
  };
}

/**
 * Clamp into a w x d rectangle centred on the room origin, inset by r.
 * A NaN coordinate resets to the centre rather than propagating through the
 * frame, the same guard Border.clamp keeps at src/border.js:47.
 */
export function clampToRoom(p, w, d, r = PLAYER_RADIUS) {
  if (!Number.isFinite(p.x) || !Number.isFinite(p.z)) { p.x = 0; p.z = 0; return true; }
  const hx = Math.max(0, w / 2 - r);
  const hz = Math.max(0, d / 2 - r);
  const x = Math.min(hx, Math.max(-hx, p.x));
  const z = Math.min(hz, Math.max(-hz, p.z));
  const moved = x !== p.x || z !== p.z;
  p.x = x; p.z = z;
  return moved;
}

/**
 * Push out of one axis-aligned prop box along the shallowest axis, so brushing
 * a counter slides you along it instead of launching you over it.
 * `box` is a centre plus full extents: { x, z, w, d }.
 */
export function pushOutOfBox(p, box, r = PLAYER_RADIUS) {
  const hx = box.w / 2 + r;
  const hz = box.d / 2 + r;
  const dx = p.x - box.x;
  const dz = p.z - box.z;
  const overlapX = hx - Math.abs(dx);
  const overlapZ = hz - Math.abs(dz);
  if (overlapX <= 0 || overlapZ <= 0) return false;
  // On an exact tie the z branch wins. Arbitrary but stable, and a tie only happens
  // on a square box approached exactly diagonally.
  //
  // The `|| 1` is not decorative: a point sitting exactly on the box centre has
  // dx === 0, and Math.sign(0) is 0, which would leave the player inside the box.
  if (overlapX < overlapZ) p.x = box.x + Math.sign(dx || 1) * hx;
  else p.z = box.z + Math.sign(dz || 1) * hz;
  return true;
}

/**
 * The room rectangle, then every prop, then the room again.
 *
 * The second room pass is not redundant: a prop standing against a wall would
 * otherwise push the player through it, and being outside the room is a much
 * worse failure than being inside a crate.
 */
export function clampInterior(p, room, boxes, r = PLAYER_RADIUS) {
  let moved = clampToRoom(p, room.w, room.d, r);
  for (const b of boxes) moved = pushOutOfBox(p, b, r) || moved;
  moved = clampToRoom(p, room.w, room.d, r) || moved;
  return moved;
}

/**
 * How far inside the room the chase camera must stay, in metres. The walls are
 * 0.2 m boxes straddling the room half-extent, so their inner faces are 0.1 m
 * in; 0.3 keeps the near plane off the plaster as well as out of the wall.
 */
export const CAMERA_INSET = 0.3;

/**
 * Keep the chase camera inside the room, on all three axes.
 *
 * The horizontal clamp is not optional. The boom is sized against the room's
 * smallest half-extent, which would only be right if the player stood at the
 * centre — they do not. interior.js drops them one metre in from the door's
 * wall, so a full-length boom directly away from that wall lands the camera
 * outside the shell. The walls are BoxGeometry with outward-facing normals, so
 * from out there the first frame after the fade lifts is a flat wall.
 *
 * `cam` is a world-space position and `origin` the room group's world position;
 * the room rectangle is centred on `origin` at floor level. Both may be
 * THREE.Vector3 — this file stays free of three.js so it tests in node.
 *
 * The vertical clamp is the pair main.js has always had, moved here so the
 * camera's containment is one testable fact rather than two: camTarget already
 * sits 1.4 m above the player, so without the ceiling bound the camera rises
 * through the ceiling slab and the room's own roof occludes the player; and
 * looking up hard subtracts from the boom's height, which without the floor
 * bound drops the camera under the floor slab.
 */
export function clampCameraToRoom(cam, origin, size, inset = CAMERA_INSET) {
  const local = { x: cam.x - origin.x, z: cam.z - origin.z };
  clampToRoom(local, size.w, size.d, inset);
  cam.x = origin.x + local.x;
  cam.z = origin.z + local.z;
  cam.y = Math.min(cam.y, origin.y + size.h - inset);
  cam.y = Math.max(cam.y, origin.y + inset);
  return cam;
}

/**
 * How far from the room centre the player should stand when they come through a
 * door, so that they end up `gap` metres in from the wall the door is on.
 *
 * Measured along the FACING axis, not against the smaller of the two extents: a
 * door on the east wall of a 12 x 9 room is 6 m from the centre, not 4.5, and
 * measuring it against the depth would strand the player 2.5 m inside the room
 * with the door behind them.
 *
 * A facing that is not cardinal splits the difference between the two axes;
 * interior.js clamps the resulting anchor back into the room, so an odd bearing
 * degrades to a legal position rather than one inside a wall.
 */
export function doorInset(facingDeg, w, d, gap = 1.0) {
  const t = ((facingDeg ?? 0) * Math.PI) / 180;
  const s = Math.abs(Math.sin(t)), c = Math.abs(Math.cos(t));
  const extent = s > c ? w : d;   // east/west doors measure across w, north/south across d
  return Math.max(0, extent / 2 - gap);
}
