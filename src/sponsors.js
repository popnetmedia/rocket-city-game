/**
 * Sponsor slot: a one-line banner top-centre under the mission bar, plus an optional
 * banner along the bottom while the player is moving. Both are off by default.
 *
 * A deployment that has a sponsor sets enabled:true and fills in `text` (and optionally
 * `url`, which opens in a new tab) and `motionBanner` (HTML allowed). Keep both short:
 * they dim with the rest of the HUD while the player is moving.
 */
export const SPONSOR = {
  enabled: false,
  text: 'THIS FLIGHT PRESENTED BY: SPONSOR NAME',
  url: '',
  motionBanner: '',
};
