import * as THREE from 'three';
import { computeBoundsTree, disposeBoundsTree, acceleratedRaycast } from 'three-mesh-bvh';

// Accelerate ALL mesh raycasts (ground collision fires many rays/frame against tile triangles).
THREE.BufferGeometry.prototype.computeBoundsTree = computeBoundsTree;
THREE.BufferGeometry.prototype.disposeBoundsTree = disposeBoundsTree;
THREE.Mesh.prototype.raycast = acceleratedRaycast;
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { TilesRenderer, WGS84_ELLIPSOID } from '3d-tiles-renderer';
import { GoogleCloudAuthPlugin, GLTFExtensionsPlugin, TileCompressionPlugin, UnloadTilesPlugin, TilesFadePlugin } from '3d-tiles-renderer/plugins';
import { TILES_ROOT, TILE_ERROR_TARGET, MAX_DOWNLOADS, MAX_PARSE, QUALITY } from './constants.js';
import { PauseReasons } from './interior/pause.js';

// Basis change: ENU (x=east, y=north, z=up) -> three.js Y-up (x=east, y=up, z=south)
const ENU_TO_YUP = new THREE.Matrix4().set(
  1, 0, 0, 0,
  0, 0, 1, 0,
  0, -1, 0, 0,
  0, 0, 0, 1,
);

const GOOGLE_LOGO_URL = 'https://developers.google.com/static/maps/documentation/tile/images/google_on_non_white.png';

/**
 * Owns the TilesRenderer, the local ENU frame at the start position,
 * and geo <-> scene conversions + ground raycasting.
 */
export class World {
  constructor({ scene, camera, renderer, apiKey, onError, origin }) {
    if (!origin || !Number.isFinite(origin.lat) || !Number.isFinite(origin.lon)
        || Math.abs(origin.lat) > 90 || Math.abs(origin.lon) > 180) {
      throw new Error(`World requires a valid { lat, lon } origin — got ${JSON.stringify(origin)}`);
    }
    this.origin = origin;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    this.onError = onError;
    this.tiles = null;
    this.ready = false; // root tileset loaded
    this.firstModel = false;
    this.paused = false;
    this._pause = new PauseReasons();
    this.collisionRoot = null; // tiles.group, or the dev world when no key

    // Local frame: ENU at the city origin, then rotated so +Y is up.
    const enu = WGS84_ELLIPSOID.getEastNorthUpFrame(
      THREE.MathUtils.degToRad(this.origin.lat), THREE.MathUtils.degToRad(this.origin.lon), 0, new THREE.Matrix4(),
    );
    this.ecefToScene = new THREE.Matrix4().multiplyMatrices(ENU_TO_YUP, enu.clone().invert());
    this.sceneToEcef = this.ecefToScene.clone().invert();

    this.raycaster = new THREE.Raycaster();
    this.raycaster.firstHitOnly = true;
    this._down = new THREE.Vector3(0, -1, 0);
    this._tmpV = new THREE.Vector3();
    this._carto = { lat: 0, lon: 0, height: 0 };

    if (apiKey) this._createTiles(apiKey);
  }

  _createTiles(apiKey) {
    const tiles = new TilesRenderer(TILES_ROOT);
    tiles.registerPlugin(new GoogleCloudAuthPlugin({ apiToken: apiKey, autoRefreshToken: true, logoUrl: GOOGLE_LOGO_URL }));

    const draco = new DRACOLoader();
    draco.setDecoderPath('/draco/');
    tiles.registerPlugin(new GLTFExtensionsPlugin({ dracoLoader: draco }));
    tiles.registerPlugin(new TileCompressionPlugin());
    tiles.registerPlugin(new UnloadTilesPlugin({ delay: 8000, bytesTarget: 200 * 1024 * 1024 }));

    tiles.errorTarget = TILE_ERROR_TARGET;
    tiles.downloadQueue.maxJobsPerOrigin = MAX_DOWNLOADS;
    tiles.parseQueue.maxJobs = MAX_PARSE;
    tiles.lruCache.minBytesSize = 250 * 1024 * 1024;
    tiles.lruCache.maxBytesSize = 500 * 1024 * 1024;
    tiles.lruCache.minSize = 1500;
    tiles.lruCache.maxSize = 3000;

    tiles.setCamera(this.camera);
    tiles.setResolutionFromRenderer(this.camera, this.renderer);

    tiles.group.matrixAutoUpdate = false;
    tiles.group.matrix.copy(this.ecefToScene);
    tiles.group.matrixWorldNeedsUpdate = true;
    this.scene.add(tiles.group);

    // 'load-root-tileset' is the 0.5.x name; 'load-tile-set' was the 0.4.x one, and
    // listening for the wrong one never throws, it just never fires (see
    // scripts/tiles-events.test.mjs).
    tiles.addEventListener('load-root-tileset', () => { this.ready = true; });
    // Photorealistic tiles carry baked lighting: render them unlit so scene lights don't wash them out, and
    // sharpen textures at grazing angles. Done via processTileModel so it runs BEFORE the fade plugin
    // prepares the materials (which it must patch for cross-fading).
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    tiles.registerPlugin({
      name: 'UNLIT_TILES_PLUGIN',
      processTileModel(scene) {
        scene.traverse((o) => {
          if (!o.isMesh || !o.material) return;
          // BVH: makes every downstream raycast ~O(log n) instead of per-triangle
          try { o.geometry.computeBoundsTree({ maxLeafTris: 16 }); } catch { /* degenerate geometry */ }
          const src = o.material;
          const map = src.map || null;
          if (map) { map.anisotropy = maxAniso; map.colorSpace = THREE.SRGBColorSpace; map.needsUpdate = true; }
          const unlit = new THREE.MeshBasicMaterial({ map, color: src.color ? src.color.clone() : 0xffffff, side: src.side });
          unlit.fog = true;
          o.material = unlit;
          src.dispose?.();
        });
      },
    });
    tiles.registerPlugin(new TilesFadePlugin({ fadeDuration: 350, maximumFadeOutTiles: 50 })); // cross-fade LOD swaps instead of popping
    tiles.addEventListener('load-model', () => { this.firstModel = true; });
    tiles.addEventListener('load-error', (e) => {
      // Always say why: the overlay shows one generic line, so a parse failure and a
      // dead server look identical from the player's side.
      console.error('[tiles] load-error', e.url, e.error);
      if (e.tile === null || !this.firstModel) this.onError?.(e.error, e.url);
    });
    tiles.addEventListener('dispose-model', ({ scene }) => {
      scene.traverse((o) => {
        o.geometry?.disposeBoundsTree?.();
        if (o.material) {
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach((m) => { m.map?.dispose(); m.dispose(); });
        }
        o.geometry?.dispose();
      });
    });

    this.tiles = tiles;
    this.collisionRoot = tiles.group;
    this._maxJobs = MAX_DOWNLOADS;
  }

  /** Apply a QUALITY preset at runtime. */
  setQuality(name) {
    const q = QUALITY[name]; if (!q) return;
    this.quality = name;
    if (this.tiles) {
      this.tiles.errorTarget = q.errorTarget;
      this.baseErrorTarget = q.errorTarget;
      this._maxJobs = q.downloads;
      if (!this.paused) this.tiles.downloadQueue.maxJobsPerOrigin = q.downloads;
      this.tiles.parseQueue.maxJobs = q.parse;
      this.tiles.lruCache.maxBytesSize = q.cacheMB * 1024 * 1024;
      this.tiles.lruCache.minBytesSize = q.cacheMB * 0.5 * 1024 * 1024;
    }
    // Only the scale: sky.js writes fog.density every frame from the weather, so
    // setting a density here would be overwritten before the next frame drew.
    // That is exactly what the old near/far write did, which is why the tier's
    // fog distances never had any effect.
    this.scene.userData.fogScale = q.fogScale ?? 1;
  }

  /**
   * Ease detail off while moving fast (fresh ground streams constantly at speed;
   * fine detail is invisible anyway), and snap back sharp when slowing down.
   */
  dynamicDetail(speedMps) {
    if (!this.tiles || !this.baseErrorTarget) return;
    const k = 1 + Math.min(2, Math.max(0, (speedMps - 20) / 30)); // 1x below 20 m/s -> 3x at 80 m/s
    const target = this.baseErrorTarget * k;
    this.tiles.errorTarget += (target - this.tiles.errorTarget) * 0.08;
  }

  get loadProgress() { return this.tiles ? this.tiles.loadProgress : 0; }
  get stats() { return this.tiles?.stats; }

  /**
   * Tile streaming is paused by REASON. The cost guard holds 'idle', the session
   * cap holds 'session', an interior holds 'interior'. Streaming resumes only
   * when the last reason lets go.
   */
  pauseFor(reason) { this._pause.add(reason); this._applyPause(); }

  resumeFor(reason) { this._pause.delete(reason); this._applyPause(); }

  _applyPause() {
    const p = this._pause.paused;
    if (!this.tiles || this.paused === p) return;
    this.paused = p;
    this.tiles.downloadQueue.maxJobsPerOrigin = p ? 0 : this._maxJobs;
  }

  update() {
    if (!this.tiles || this.paused) return;
    // A zero-sized renderer poisons the traversal rather than merely delaying it: the
    // tile renderer divides by the camera resolution to get screen-space error, so a
    // height of 0 makes every tile's error NaN, no tile ever qualifies to load, and the
    // only symptom is a console warning about resolution and a permanently empty view.
    const el = this.renderer.domElement;
    if (!el.width || !el.height) return;
    this.tiles.setResolutionFromRenderer(this.camera, this.renderer);
    this.tiles.update();
  }

  onResize() { this.tiles?.setResolutionFromRenderer(this.camera, this.renderer); }

  /** lat/lon (deg) -> scene xz only (y=0); cheap helper for footprint projection */
  geoToSceneFlat(lat, lon, target) {
    this.geoToScene(lat, lon, 0, target);
    target.y = 0;
    return target;
  }

  /** lat/lon (deg) -> scene position at ellipsoid height h */
  geoToScene(lat, lon, h = 0, target = new THREE.Vector3()) {
    WGS84_ELLIPSOID.getCartographicToPosition(THREE.MathUtils.degToRad(lat), THREE.MathUtils.degToRad(lon), h, target);
    return target.applyMatrix4(this.ecefToScene);
  }

  /** scene position -> {lat, lon, height} in degrees/metres */
  sceneToGeo(pos) {
    this._tmpV.copy(pos).applyMatrix4(this.sceneToEcef);
    WGS84_ELLIPSOID.getPositionToCartographic(this._tmpV, this._carto);
    return {
      lat: THREE.MathUtils.radToDeg(this._carto.lat),
      lon: THREE.MathUtils.radToDeg(this._carto.lon),
      height: this._carto.height,
    };
  }

  /**
   * Cast a ray straight down from `origin` (scene space) and return the hit
   * point on the loaded tile meshes, or null.
   */
  groundBelow(origin, maxDist = 2000, tilesOnly = false) {
    if (!this.collisionRoot) return null;
    this.raycaster.set(origin, this._down);
    this.raycaster.near = 0;
    this.raycaster.far = maxDist;
    const targets = [this.collisionRoot];
    if (!tilesOnly && this.extraCollision) targets.push(this.extraCollision);
    const hits = this.raycaster.intersectObjects(targets, true);
    if (hits.length === 0) return null;
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0];
  }

  /** Key-missing branch only: use a local stand-in mesh as the collision world. */
  useDevWorld(group) {
    if (this.tiles) return;
    this.scene.add(group);
    group.updateMatrixWorld(true); // raycasts happen before the first render
    group.traverse((o) => { if (o.isMesh) { try { o.geometry.computeBoundsTree(); } catch { /* ok */ } } });
    this.collisionRoot = group;
    this.ready = true;
  }

  /**
   * Temporarily raycast against a hand-built group instead of the tiles.
   * useDevWorld() refuses to run when tiles exist and extraCollision already
   * belongs to the OSM overlay, so an interior needs its own hook that restores
   * whatever was there before.
   *
   * The matrix update and BVH build happen here because the first ground
   * raycast fires before the first render of the new group.
   */
  pushCollision(group) {
    (this._collisionStack ||= []).push({ root: this.collisionRoot, extra: this.extraCollision });
    group.updateMatrixWorld(true);
    group.traverse((o) => { if (o.isMesh) { try { o.geometry.computeBoundsTree(); } catch { /* ok */ } } });
    this.collisionRoot = group;
    // extraCollision holds the OSM building overlay, and groundBelow appends it to
    // the raycast targets unless tilesOnly is passed. A room is built at the door's
    // real-world position, so the OSM box for that very building is sitting in the
    // same space: leaving it in place would let the player stand on a phantom roof
    // instead of the room floor. Stash it and put it back on pop.
    this.extraCollision = null;
  }

  popCollision() {
    if (!this._collisionStack?.length) return;
    const prev = this._collisionStack.pop();
    this.collisionRoot = prev.root;
    this.extraCollision = prev.extra;
  }

  getAttributions() { return this.tiles ? this.tiles.getAttributions() : []; }

  dispose() { this.tiles?.dispose(); }
}
