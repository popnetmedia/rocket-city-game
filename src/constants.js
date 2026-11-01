export const TILES_ROOT = 'https://tile.googleapis.com/v1/3dtiles/root.json';

// Cost guard timings (ms)
export const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
export const SESSION_CAP_MS = 45 * 60 * 1000;

// Rendering
export const MAX_PIXEL_RATIO = 2;

/**
 * Haze density for a clear day at the HIGH tier. FogExp2, so this is a rate, not
 * a distance: visibility falls off as 1 - exp(-(density*d)^2).
 *
 * Haze is the one visual lever that LOWERS running cost. Google bills per tile
 * request, so errorTarget is the expensive knob; distance haze hides exactly the
 * blurry low-LOD tiles and the pop-in that tempts you to lower it.
 */
export const BASE_FOG_DENSITY = 0.0004;

/**
 * Metres above ground a player may fly, unless a city overrides it with `flyCeiling`.
 *
 * The cap is a streaming budget, not a rule of the world: the higher you go the more
 * city is in frustum at once, and Google bills per tile request. 320 m is generous
 * over a two-to-four storey downtown and wrong over a skyline -- One World Trade is
 * 541 m, so at 320 Manhattan could not be flown over at all.
 */
export const DEFAULT_FLY_CEILING = 320;

// Tile quality presets — G cycles them in-game. errorTarget = screen-space error in px (lower = sharper, more downloads).
// fogScale multiplies BASE_FOG_DENSITY: the blurrier the tier, the more haze hides it.
export const QUALITY = {
  LOW:   { errorTarget: 12, downloads: 6,  parse: 2, fogScale: 1.6,  cacheMB: 200 },
  MED:   { errorTarget: 6,  downloads: 8,  parse: 2, fogScale: 1.25, cacheMB: 300 },
  HIGH:  { errorTarget: 3,  downloads: 12, parse: 3, fogScale: 1.0,  cacheMB: 500 },
  ULTRA: { errorTarget: 1.5, downloads: 16, parse: 4, fogScale: 0.75, cacheMB: 800 },
};
export const DEFAULT_QUALITY = (import.meta.env.VITE_TILE_QUALITY || 'HIGH').toUpperCase();
export const TILE_ERROR_TARGET = QUALITY[DEFAULT_QUALITY]?.errorTarget ?? 3;
export const MAX_DOWNLOADS = QUALITY[DEFAULT_QUALITY]?.downloads ?? 12;
export const MAX_PARSE = QUALITY[DEFAULT_QUALITY]?.parse ?? 3;

// Player / vehicle physics (metres, seconds)
export const WALK_SPEED = 4.5;
export const SPRINT_SPEED = 9.5;
export const JUMP_VELOCITY = 6.5;
export const GRAVITY = 18;
export const PLAYER_HEIGHT = 1.8;
export const MPH_PER_MPS = 2.23694;
