import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Cinematic grade (the trick sf.thijs.gg uses): ACES filmic tone mapping + a
 * contrast/saturation/vibrance post pass. Applied to our UNLIT tiles so we get
 * the filmic pop without reintroducing double-lighting washout. Toggleable.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    contrast: { value: 1.12 },
    saturation: { value: 1.24 },
    brightness: { value: 0.98 },
    vignette: { value: 0.18 },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float contrast, saturation, brightness, vignette; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb * brightness;
      col = (col - 0.5) * contrast + 0.5;                 // contrast about mid-grey
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));   // luminance
      col = mix(vec3(l), col, saturation);                // saturation
      vec2 d = vUv - 0.5; col *= 1.0 - dot(d, d) * vignette; // gentle vignette
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a);
    }`,
};

export class Grade {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    // Off by default: the ungraded photogrammetry reads truer to the real city
    // (2026-09-06). J toggles it, and an explicit 'on' is remembered, so anyone
    // who turned it on stays on.
    this.enabled = false;
    try { if (localStorage.getItem('rocketcity.grade') === 'on') this.enabled = true; } catch {}
    // three's EffectComposer builds its target with no `samples`, so the renderer's
    // `antialias: true` stops applying the moment anything renders through here.
    // Enabling the grade used to trade tone mapping for jagged edges; it no longer does.
    const size = renderer.getSize(new THREE.Vector2());
    const pr = renderer.getPixelRatio();
    const rt = new THREE.WebGLRenderTarget(size.x * pr, size.y * pr, {
      type: THREE.HalfFloatType,
      samples: 4,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.composer.addPass(new RenderPass(scene, camera));
    this.gradePass = new ShaderPass(GradeShader);
    this.composer.addPass(this.gradePass);
    this.composer.addPass(new OutputPass()); // sRGB + tone mapping applied here
    this._apply();
    this.resize();
  }

  _apply() {
    this.renderer.toneMapping = this.enabled ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 0.98;
    this.gradePass.enabled = this.enabled;
  }

  toggle() {
    this.enabled = !this.enabled;
    this._apply();
    try { localStorage.setItem('rocketcity.grade', this.enabled ? 'on' : 'off'); } catch {}
    return this.enabled;
  }

  resize() {
    const r = this.renderer.getSize(new THREE.Vector2());
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(r.x, r.y);
  }

  render() {
    if (this.enabled) this.composer.render();
    else this.renderer.render(this.composer.passes[0].scene, this.composer.passes[0].camera);
  }
}
