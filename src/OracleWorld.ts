import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { AfterimagePass } from "three/examples/jsm/postprocessing/AfterimagePass.js";
import { MeshSurfaceSampler } from "three/examples/jsm/math/MeshSurfaceSampler.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import type { Gesture } from "./types";

const ARCHIVE_DEPTH = 78;
const PAGE_IMAGES = [
  "/images/windows-xp-bliss.jpg",
  "/images/webcam-room.png",
  "/images/dead-mall.png",
  "/images/retro-hills.png",
  "/images/windows-xp-autumn.jpg",
  "/images/retro-orbs.png",
  "/images/homepage-garden.png",
];
const PAGE_DEPTHS = [-5.5, -13.5, -18.5, -27.75, -42, -56.25, -75.5];
const STORY_BEATS = [
  0, 3.5, 7.5, 11.5, 17, 21.5, 26, 30.5, 35, 41, 45.5, 50, 54.5, 59, 64, 69,
];
const ACTS = [
  { end: 7, name: "I · BOOT SECTOR", bg: 0x020609, fog: 0x07121a, curve: 0.1 },
  {
    end: 17,
    name: "II · HUMAN CACHE",
    bg: 0x090603,
    fog: 0x1b1008,
    curve: 0.16,
  },
  {
    end: 39,
    name: "III · ORGANIC INFECTION",
    bg: 0x020804,
    fog: 0x0b1b0d,
    curve: 0.12,
  },
  {
    end: 58,
    name: "IV · MACHINE THEOLOGY",
    bg: 0x07030d,
    fog: 0x1b0b28,
    curve: 0.24,
  },
  {
    end: 78,
    name: "V · AFTER THE USER",
    bg: 0x01040a,
    fog: 0x071329,
    curve: 0.31,
  },
] as const;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const focusAt = (distance: number) => 1 / (1 + Math.pow(distance * 0.68, 4));
const ARTIFACT_SHOTS: Record<
  string,
  { x: number; y: number; yaw: number; pitch: number; roll: number }
> = {
  "GUESTBOOK FRAME": { x: -2.4, y: 0.34, yaw: -0.12, pitch: 0, roll: -0.03 },
  "UNSENT DEVICE": { x: 2.45, y: -0.3, yaw: 0.5, pitch: -0.08, roll: 0.12 },
  "ORPHANED USERS": { x: -2.15, y: 0.05, yaw: -0.28, pitch: 0, roll: 0 },
  "IDLE USER": { x: 2.3, y: -0.82, yaw: 0.2, pitch: -0.16, roll: 0.03 },
  "RECOVERED FLOWER": {
    x: -2.35,
    y: -0.36,
    yaw: 0.18,
    pitch: -0.72,
    roll: -0.08,
  },
  "CACHED FOREST": { x: 2.5, y: -0.42, yaw: -0.18, pitch: 0.03, roll: 0 },
  "HARVEST CACHE": { x: -2.35, y: -0.62, yaw: -0.3, pitch: 0.08, roll: -0.05 },
  "SPORE PROTOCOL": { x: 2.42, y: -0.58, yaw: 0.36, pitch: -0.04, roll: 0.04 },
  "BIOLUMINESCENT ERROR": {
    x: -2.3,
    y: 0.18,
    yaw: -0.42,
    pitch: 0.08,
    roll: -0.06,
  },
  "PASTORAL REMAINS": {
    x: 2.3,
    y: 0.04,
    yaw: -0.72,
    pitch: -0.08,
    roll: 0.08,
  },
  "LOCAL GOD": { x: -2.2, y: 0.22, yaw: 0.16, pitch: 0.02, roll: -0.02 },
  "CIRCULAR ARGUMENT": { x: 2.35, y: -0.08, yaw: 0, pitch: 0, roll: 0 },
  "RECURSIVE DECORATION": { x: -2.38, y: 0.26, yaw: 0, pitch: 0, roll: 0 },
  "REACTION WITHOUT OWNER": {
    x: 2.5,
    y: 0.16,
    yaw: 0.28,
    pitch: -0.04,
    roll: 0.05,
  },
  "NONHUMAN MODERATOR": {
    x: -2.35,
    y: 0.42,
    yaw: -0.24,
    pitch: 0.12,
    roll: -0.04,
  },
  "UNRESOLVED SCAN": { x: 2.25, y: -0.14, yaw: 0.34, pitch: -0.06, roll: 0.03 },
};

const pageVertex = /* glsl */ `
  uniform float uTime,uExcavate,uTear; uniform vec2 uHand; varying vec2 vUv; varying float vEdge,vDamage;
  float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  void main(){
    vUv=uv; vec3 p=position; float side=uv.x-.5;
    p.z-=side*side*(1.1+uExcavate*.9);
    p.z+=sin(uv.y*12.+uTime*.4+position.x)*.035;
    float hand=exp(-length(uv-uHand)*9.);
    float slice=step(.84,hash(vec2(floor(uv.y*24.),floor(uTime*6.))))*uTear;
    p.x+=(hash(vec2(floor(uv.y*30.),floor(uTime*7.)))-.5)*slice*1.2;
    p.z+=hand*uExcavate*.45;
    vEdge=abs(side)*2.;vDamage=slice+hand*uTear;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
  }
`;
const pageFragment = /* glsl */ `
  uniform sampler2D uMap; uniform float uTime,uTear,uExcavate,uOpacity; varying vec2 vUv; varying float vEdge,vDamage;
  float hash(vec2 p){return fract(sin(dot(p,vec2(41.7,289.1)))*951.135);}
  void main(){
    vec2 uv=vUv; float band=floor(uv.y*180.);
    uv.x+=(hash(vec2(band,floor(uTime*9.)))-.5)*uTear*step(.78,hash(vec2(band,floor(uTime*4.))))*.12;
    vec4 tex=texture2D(uMap,clamp(uv,0.,1.));
    float scan=.88+.12*sin(gl_FragCoord.y*2.1+uTime*3.);
    float burn=smoothstep(.7,.02,length(vUv-.5))*0.16;
    vec3 color=tex.rgb*scan*1.42+vec3(.08,.15,.13)*burn;
    color.r+=vDamage*.18;color.gb-=vDamage*.08;
    float alpha=uOpacity*(.84-vEdge*.32)*(tex.a);
    if(hash(gl_FragCoord.xy+uTime)<uTear*.018) discard;
    gl_FragColor=vec4(color,alpha);
  }
`;

const artifactPointVertex = /* glsl */ `
  uniform float uTime,uTear,uExcavate,uHero;uniform vec2 uHand;varying vec3 vColor;varying vec2 vUv;varying float vGlow,vField;
  float hash(float n){return fract(sin(n)*43758.5453);}
  void main(){
    vec3 p=position;vec4 baseClip=projectionMatrix*modelViewMatrix*vec4(p,1.);vec2 screen=baseClip.xy/baseClip.w*.5+.5;
    float influence=exp(-length(screen-uHand)*10.);float seed=hash(float(gl_VertexID)*.017);
    vec3 dir=normalize(p+vec3(.001));
    p+=dir*influence*(uExcavate*.34+uTear*.18)*(.35+seed);
    p.x+=sin(p.y*5.+uTime*2.+seed*9.)*influence*uTear*.1;
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    gl_PointSize=(1.05+uHero*1.65+influence*1.35)*(1.+seed*.24)*clamp(28./-mv.z,.65,3.5);
    vColor=color.rgb;vUv=uv;vGlow=influence+uHero*.1;vField=.5+.5*sin(position.y*4.+position.x*2.+position.z*3.);
  }
`;
const artifactPointFragment = /* glsl */ `
  uniform sampler2D uMap;uniform float uHasMap;uniform vec3 uAccent;varying vec3 vColor;varying vec2 vUv;varying float vGlow,vField;
  void main(){vec2 p=gl_PointCoord-.5;float d=length(p);if(d>.5)discard;float core=smoothstep(.5,.08,d);vec3 tex=mix(vec3(1.),texture2D(uMap,vUv).rgb,uHasMap);vec3 c=pow(max(vColor*tex,vec3(.001)),vec3(.82));float pale=smoothstep(.72,.96,min(c.r,min(c.g,c.b)));vec3 accent=mix(uAccent,uAccent.bgr,vField*.3);c=mix(c,accent,pale*.62);c*=1.04+vGlow*.3;gl_FragColor=vec4(c,core*.96);}
`;

const pngPointVertex = /* glsl */ `
  uniform float uTime,uTear,uExcavate,uFocus,uMode;uniform vec2 uHand;attribute float aSeed;varying vec3 vColor;varying float vAlpha,vSeed;
  void main(){
    vec3 p=position;float wave=sin(p.y*(2.2+uMode*.7)+uTime*(.28+uMode*.06)+aSeed*8.);
    p.z+=wave*(.035+uFocus*.08);p.x+=sin(p.y*3.+uTime*.2+aSeed*12.)*.025;
    vec4 first=projectionMatrix*modelViewMatrix*vec4(p,1.);vec2 screen=first.xy/first.w*.5+.5;
    vec2 delta=screen-uHand;float nearHand=exp(-length(delta)*8.5);vec2 away=normalize(delta+vec2(.0001));
    float excavation=nearHand*(uExcavate*.82+uTear*.34);p.xy+=away*excavation*(.45+aSeed*.8);p.z+=excavation*(.4+aSeed*.7);
    if(uMode>1.5)p.x+=sin(p.y*7.+uTime+aSeed*5.)*uFocus*.07;
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    gl_PointSize=(1.25+uFocus*1.7+nearHand*1.4)*(1.+aSeed*.45)*clamp(26./-mv.z,.6,3.4);
    vColor=color;vAlpha=(.28+uFocus*.72)*(1.-excavation*.34);vSeed=aSeed;
  }
`;
const pngPointFragment = /* glsl */ `
  uniform float uMode,uOpacity;varying vec3 vColor;varying float vAlpha,vSeed;
  void main(){vec2 p=gl_PointCoord-.5;float d=uMode<.5?length(p):max(abs(p.x),abs(p.y));if(d>.5)discard;float core=smoothstep(.5,.06,d);vec3 c=pow(max(vColor,vec3(.002)),vec3(.82));if(uMode>1.5)c=mix(c,c.bgr,.18+vSeed*.16);gl_FragColor=vec4(c,core*vAlpha*uOpacity);}
`;

const worldShellVertex = /* glsl */ `
  varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}
`;
const worldShellFragment = /* glsl */ `
  uniform sampler2D uMap;uniform float uTime,uOpacity,uFocus,uMode;uniform vec2 uHand;varying vec2 vUv;
  void main(){
    vec2 uv=vUv;float hand=exp(-length(uv-uHand)*6.);uv.x+=sin(uv.y*16.-uTime*.25+uMode*2.)*.004*uFocus;uv.y+=sin(uv.x*19.+uTime*.18)*.0025*uFocus+hand*.008;
    vec3 c=texture2D(uMap,clamp(uv,vec2(.002),vec2(.998))).rgb;c=pow(max(c,vec3(.001)),vec3(.92));
    float horizon=smoothstep(.02,.22,uv.y)*smoothstep(.98,.72,uv.y),centerQuiet=1.-exp(-length(uv-.5)*5.);c*=.38+uFocus*.36;c=mix(c,c*vec3(.72,.9,1.06),hand*.18);
    gl_FragColor=vec4(c,uOpacity*horizon*(.86+centerQuiet*.14));
  }
`;

const debrisVertex = /* glsl */ `
  uniform float uTime,uDepth,uTear,uExcavate,uHero; uniform vec2 uHand; attribute float aSeed; varying float vSeed,vFade;
  void main(){
    vec3 p=position; p.x+=sin(uTime*.17+aSeed*17.+p.z)*.16; p.y+=cos(uTime*.13+aSeed*23.+p.z)*.12;
    float local=exp(-length((p.xy/10.+.5)-uHand)*7.);p.xy+=(uHand-.5)*local*uExcavate*2.;
    p.x+=sin(p.z*3.+uTime*12.+aSeed)*uTear*.7;
    vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;
    gl_PointSize=(1.+aSeed*2.+local*3.)*clamp(28./-mv.z,.5,4.);vSeed=aSeed;vFade=smoothstep(45.,3.,-mv.z);
  }
`;
const debrisFragment = /* glsl */ `
  uniform float uTime,uTear,uHero; varying float vSeed,vFade;
  void main(){vec2 p=gl_PointCoord-.5;if(length(p)>.5)discard;vec3 a=vec3(.32,.45,.40),b=vec3(.50,.35,.20),c=vec3(.42,.07,.20);vec3 col=mix(a,b,step(.72,vSeed));col=mix(col,c,uTear*step(.9,vSeed));gl_FragColor=vec4(col,(.015+vSeed*.055)*vFade*(1.-uHero*.94));}
`;

const distortionShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uTear: { value: 0 },
    uCurve: { value: 0.16 },
    uHand: { value: new THREE.Vector2(0.5, 0.5) },
  },
  vertexShader:
    "varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;uniform float uTime,uTear,uCurve;uniform vec2 uHand;varying vec2 vUv;
    float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
    void main(){
      vec2 uv=vUv;vec2 p=uv-.5;float r=dot(p,p);uv+=p*r*uCurve;
      float line=floor(uv.y*240.);float cut=step(.91,hash(vec2(line,floor(uTime*8.))))*uTear;
      uv.x+=(hash(vec2(line,floor(uTime*15.)))-.5)*cut*.16;
      float nearHand=exp(-length(uv-uHand)*8.);uv+=normalize(p+0.001)*sin(length(p)*70.-uTime*4.)*.002*nearHand;
      float shift=.0006+uTear*.004;
      float rr=texture2D(tDiffuse,uv+vec2(shift,0)).r;float gg=texture2D(tDiffuse,uv).g;float bb=texture2D(tDiffuse,uv-vec2(shift,0)).b;
      vec3 col=vec3(rr,gg,bb);col*=.93+.07*sin(gl_FragCoord.y*3.14159);
      float vig=smoothstep(.78,.18,length(p));col*=.52+.48*vig;col+=(hash(gl_FragCoord.xy+uTime)-.5)*.014;
      if(uv.x<0.||uv.x>1.||uv.y<0.||uv.y>1.)col=vec3(.005,.008,.006);
      gl_FragColor=vec4(col,1.);
    }`,
};

type ArchiveObject = THREE.Object3D;

export class OracleWorld {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(54, 1, 0.1, 100);
  private composer: EffectComposer;
  private distortion: ShaderPass;
  private afterimage: AfterimagePass;
  private archive: ArchiveObject[] = [];
  private artifacts: ArchiveObject[] = [];
  private companions: ArchiveObject[] = [];
  private artifactSet = new Set<ArchiveObject>();
  private companionSet = new Set<ArchiveObject>();
  private pngClouds: THREE.Points[] = [];
  private worldShells: THREE.Mesh[] = [];
  private worldShellLoading = new Set<number>();
  private readonly worldShellSpecs = [
    ["/images/pretville_cinema_4k.hdr", -11.5, -0.35],
    ["/images/autumn_forest_02_4k.hdr", -25.5, 0.72],
    ["/images/abandoned_workshop_02_1k.hdr", -49.5, 1.84],
  ] as const;
  private retroIcons: THREE.Sprite[] = [];
  private chapterGates: THREE.Points[] = [];
  private storyThread = new THREE.Group();
  private root = new THREE.Group();
  private actBg = ACTS.map((a) => new THREE.Color(a.bg));
  private actFog = ACTS.map((a) => new THREE.Color(a.fog));
  private projected = new THREE.Vector3();
  private handTarget = new THREE.Vector2();
  private uniforms = {
    uTime: { value: 0 },
    uExcavate: { value: 0 },
    uTear: { value: 0 },
    uHand: { value: new THREE.Vector2(0.5, 0.5) },
    uDepth: { value: 0 },
    uHero: { value: 0 },
  };
  depth = 0;
  tear = 0;
  chapter = 0;
  private speed = 0;
  onArtifact?: (name: string, chapter: number) => void;
  onChapter?: (chapter: number, name: string) => void;
  private activeArtifact = "";
  private warmupTimer = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.scene.background = new THREE.Color(0x030605);
    this.scene.fog = new THREE.FogExp2(0x06100d, 0.034);
    this.camera.position.set(0, 0, 5.5);
    this.scene.add(this.root);
    const debugDepth = Number(
      new URLSearchParams(location.search).get("depth"),
    );
    if (Number.isFinite(debugDepth))
      this.depth = clamp(debugDepth, 0, ARCHIVE_DEPTH - 0.001);
    this.makePages();
    this.makeDebris();
    this.makeMemoryThread();
    this.makeChapterGates();
    this.makeRetroIcons();
    this.makeWorldShells();
    this.makePngParticleArchives();
    this.loadArtifacts();
    this.loadCompanions();
    this.scene.add(new THREE.AmbientLight(0x536c62, 1.5));
    const light = new THREE.PointLight(0xc6a761, 28, 24, 1.7);
    light.position.set(-3, 2, 2);
    this.scene.add(light);
    const magenta = new THREE.PointLight(0x8d244e, 18, 18, 2);
    magenta.position.set(4, -2, -8);
    this.scene.add(magenta);
    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.afterimage = new AfterimagePass(0.66);
    this.composer.addPass(this.afterimage);
    this.distortion = new ShaderPass(distortionShader);
    this.composer.addPass(this.distortion);
    this.scheduleShaderWarmup();
    addEventListener("resize", this.resize);
    this.resize();
  }

  private scheduleShaderWarmup() {
    clearTimeout(this.warmupTimer);
    this.warmupTimer = window.setTimeout(() => {
      void this.renderer.compileAsync(this.scene, this.camera);
    }, 180);
  }

  private freezeStaticHierarchy(root: THREE.Object3D) {
    root.traverse((child) => {
      if (child === root) return;
      child.updateMatrix();
      child.matrixAutoUpdate = false;
    });
  }

  private makeArchiveTexture(index: number) {
    const t = new THREE.TextureLoader().load(
      PAGE_IMAGES[index % PAGE_IMAGES.length],
    );
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  }

  private makePages() {
    for (let i = 0; i < PAGE_IMAGES.length; i++) {
      const uniforms = {
        ...this.uniforms,
        uMap: { value: this.makeArchiveTexture(i) },
        uOpacity: { value: 0.8 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms,
        vertexShader: pageVertex,
        fragmentShader: pageFragment,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(8.6, 5.25, 48, 30),
        mat,
      ) as ArchiveObject;
      const baseX = (Math.random() - 0.5) * 1.2,
        baseY = (Math.random() - 0.5) * 0.7;
      mesh.userData = {
        baseZ: PAGE_DEPTHS[i],
        drift: Math.random(),
        baseX,
        baseY,
        isPage: true,
      };
      mesh.position.set(baseX, baseY, mesh.userData.baseZ);
      mesh.rotation.set(
        (Math.random() - 0.5) * 0.06,
        (Math.random() - 0.5) * 0.16,
        (Math.random() - 0.5) * 0.04,
      );
      mesh.scale.setScalar(0.9 + Math.random() * 0.1);
      this.root.add(mesh);
      this.archive.push(mesh);
    }
  }

  private makeDebris() {
    const count = 18000,
      pos = new Float32Array(count * 3),
      seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 15;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 2] = -Math.random() * ARCHIVE_DEPTH;
      seed[i] = Math.random();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: debrisVertex,
      fragmentShader: debrisFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geo, mat) as ArchiveObject;
    points.userData = { baseZ: 0, drift: 0 };
    this.root.add(points);
  }

  private makeMemoryThread() {
    const count = 1800,
      pos = new Float32Array(count * 3),
      colors = new Float32Array(count * 3),
      palette = [
        new THREE.Color(0x75a8b8),
        new THREE.Color(0xc69265),
        new THREE.Color(0x75b66f),
        new THREE.Color(0xb277cf),
        new THREE.Color(0x668cd8),
      ];
    for (let i = 0; i < count; i++) {
      const t = i / (count - 1),
        z = -t * ARCHIVE_DEPTH,
        found = ACTS.findIndex((a) => t * ARCHIVE_DEPTH < a.end),
        chapter = found < 0 ? 4 : found;
      pos[i * 3] = Math.sin(z * 0.31) * (0.45 + t * 0.9);
      pos[i * 3 + 1] = Math.sin(z * 0.17 + 1.2) * (0.25 + t * 0.38);
      pos[i * 3 + 2] = z;
      const c = palette[chapter];
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const dust = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        vertexColors: true,
        size: 0.035,
        transparent: true,
        opacity: 0.42,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      }),
    );
    this.storyThread.add(line, dust);
    this.root.add(this.storyThread);
  }

  private makeChapterGates() {
    const colors = [0xd1a768, 0x6eb480, 0xc27ada, 0x718fe0];
    ACTS.slice(0, -1).forEach((act, index) => {
      const count = 1400,
        pos = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2,
          r = 1.4 + Math.sin(a * (5 + index)) * 0.22 + (i % 11) * 0.006;
        pos[i * 3] = Math.cos(a) * r;
        pos[i * 3 + 1] = Math.sin(a) * r;
        pos[i * 3 + 2] = Math.sin(a * (3 + index)) * 0.14;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      const mat = new THREE.PointsMaterial({
        color: colors[index],
        size: 0.025,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true,
      });
      const gate = new THREE.Points(geo, mat);
      gate.userData.baseZ = -(act.end + 4);
      this.root.add(gate);
      this.chapterGates.push(gate);
    });
  }

  private makeIconTexture(kind: number) {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const c = canvas.getContext("2d")!;
    c.imageSmoothingEnabled = false;
    const px = (x: number, y: number, w: number, h: number, color: string) => {
      c.fillStyle = color;
      c.fillRect(x, y, w, h);
    };
    px(5, 6, 23, 22, "rgba(0,0,0,.42)");
    if (kind === 0) {
      px(4, 9, 25, 18, "#d6b84a");
      px(6, 6, 10, 5, "#f2d76e");
      px(6, 12, 21, 13, "#f7dc66");
      px(7, 14, 19, 2, "#fff2a0");
    } else if (kind === 1) {
      px(5, 4, 22, 24, "#879ba5");
      px(8, 7, 16, 11, "#78d8d1");
      px(10, 9, 12, 7, "#143c50");
      px(9, 22, 14, 3, "#bac8c5");
      px(14, 18, 4, 4, "#3c4d54");
    } else if (kind === 2) {
      px(6, 4, 20, 24, "#79888f");
      px(9, 5, 12, 7, "#27363c");
      px(9, 15, 14, 10, "#d7ddd5");
      px(11, 17, 10, 6, "#52656b");
      px(20, 6, 3, 6, "#d97d5e");
    } else if (kind === 3) {
      px(8, 4, 17, 5, "#d1d7cf");
      px(6, 9, 21, 18, "#9ba69f");
      px(9, 11, 15, 12, "#1c2426");
      px(11, 13, 11, 8, "#665c4d");
      px(12, 3, 9, 2, "#d1d7cf");
    } else if (kind === 4) {
      px(4, 5, 23, 22, "#6ab5c3");
      px(7, 8, 17, 16, "#162c47");
      px(14, 8, 3, 16, "#a9e2df");
      px(7, 15, 17, 3, "#a9e2df");
      px(10, 10, 11, 12, "rgba(80,172,183,.6)");
    } else if (kind === 5) {
      px(5, 5, 5, 5, "#ece9d8");
      px(9, 9, 5, 5, "#ece9d8");
      px(13, 13, 5, 5, "#ece9d8");
      px(17, 17, 5, 5, "#ece9d8");
      px(21, 21, 5, 5, "#ece9d8");
      px(8, 8, 2, 2, "#111");
    } else if (kind === 6) {
      px(14, 4, 4, 4, "#f0c84b");
      px(10, 8, 12, 12, "#d54d42");
      px(6, 12, 20, 4, "#d54d42");
      px(14, 20, 4, 7, "#f0c84b");
      px(15, 10, 2, 7, "#fff3b0");
      px(15, 19, 2, 2, "#fff3b0");
    } else if (kind === 7) {
      px(4, 8, 24, 18, "#e4dfc9");
      px(6, 10, 20, 14, "#f6f0d7");
      px(7, 11, 9, 6, "#6f9bb4");
      px(16, 11, 9, 6, "#b36f7d");
      px(8, 20, 16, 2, "#76726b");
    } else if (kind === 8) {
      px(6, 5, 20, 22, "#d9d4c4");
      px(8, 7, 16, 18, "#fffdf0");
      px(10, 10, 12, 2, "#7391a0");
      px(10, 15, 9, 2, "#7391a0");
      px(10, 20, 12, 2, "#7391a0");
    } else if (kind === 9) {
      px(7, 5, 18, 4, "#8da1aa");
      px(10, 9, 12, 5, "#d9b868");
      px(12, 14, 8, 4, "#e9dbac");
      px(10, 18, 12, 5, "#6c8995");
      px(7, 23, 18, 4, "#8da1aa");
    } else if (kind === 10) {
      px(5, 8, 22, 17, "#536b79");
      px(8, 11, 16, 11, "#91d0be");
      px(10, 13, 4, 3, "#f1cb64");
      px(16, 16, 6, 3, "#d77276");
      px(7, 5, 5, 4, "#a8b8bd");
      px(20, 5, 5, 4, "#a8b8bd");
    } else if (kind === 11) {
      px(5, 11, 8, 10, "#9baeb7");
      px(13, 8, 10, 16, "#d5ddda");
      px(23, 11, 4, 10, "#768b95");
      px(14, 12, 7, 8, "#1d3f55");
      px(15, 14, 5, 4, "#6db5c6");
    } else if (kind === 12) {
      px(5, 5, 22, 22, "#dfddd0");
      px(8, 8, 16, 16, "#14191b");
      px(10, 17, 4, 4, "#df5c59");
      px(15, 12, 4, 9, "#e6ca58");
      px(20, 9, 3, 12, "#65aa87");
    } else {
      px(6, 5, 20, 22, "#c9c7ba");
      px(8, 7, 16, 18, "#efede1");
      px(10, 9, 12, 9, "#4e7589");
      px(11, 10, 10, 7, "#9bc8cb");
      px(9, 21, 4, 2, "#d85d5d");
      px(15, 21, 8, 2, "#5a6a70");
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  private makeRetroIcons() {
    const textures = Array.from({ length: 14 }, (_, i) =>
        this.makeIconTexture(i),
      ),
      depths = [
        -6.5, -10.5, -14.5, -22.5, -26.5, -47, -52, -57, -67, -71, -8.5, -24.5,
        -49.5, -69,
      ];
    for (let i = 0; i < textures.length; i++) {
      const mat = new THREE.SpriteMaterial({
        map: textures[i],
        transparent: true,
        depthWrite: false,
        opacity: 0.72,
        toneMapped: false,
      });
      const sprite = new THREE.Sprite(mat);
      const cluster = Math.floor(i / 4),
        slot = i % 4,
        restX = (slot - 1.5) * 1.75 + (cluster % 2) * 0.38,
        restY = (((slot * 2 + cluster) % 4) - 1.5) * 1.05,
        baseZ = depths[i];
      sprite.userData = { baseZ, restX, restY, seed: Math.random() * 10 };
      sprite.position.set(restX, restY, baseZ);
      sprite.scale.setScalar(0.46 + (i % 3) * 0.12);
      this.root.add(sprite);
      this.retroIcons.push(sprite);
    }
  }

  private makePngParticleArchives() {
    const image = new Image();
    image.src = "/images/dead-internet-atlas.png";
    image.onload = () => {
      const cols = 4,
        rows = 3,
        tileW = Math.floor(image.width / cols),
        tileH = Math.floor(image.height / rows),
        canvas = document.createElement("canvas"),
        ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      canvas.width = tileW;
      canvas.height = tileH;
      const depths = [
          -1.2, -5.6, -9.7, -14.2, -18.1, -23.2, -28.1, -33.3, -38.2, -43.3,
          -52.2, -61.3,
        ],
        names = [
          "BEDROOM CACHE",
          "FAMILY WITHOUT FACES",
          "FOUNTAIN DIRECTORY",
          "CANDLE TERMINAL",
          "STONE ANGEL",
          "EMPTY LOBBY",
          "DISC MEMORY",
          "TOUCH SCREEN",
          "POCKET ORGANISM",
          "SERVER AISLE",
          "SYNTHETIC USER",
          "GARDEN LOGIN",
        ];
      for (let tile = 0; tile < 12; tile++) {
        const sx = (tile % cols) * tileW,
          sy = Math.floor(tile / cols) * tileH;
        ctx.clearRect(0, 0, tileW, tileH);
        ctx.drawImage(image, sx, sy, tileW, tileH, 0, 0, tileW, tileH);
        const pixels = ctx.getImageData(0, 0, tileW, tileH).data,
          count = 10500,
          pos = new Float32Array(count * 3),
          colors = new Float32Array(count * 3),
          seeds = new Float32Array(count);
        let written = 0,
          attempts = 0;
        while (written < count && attempts < count * 12) {
          attempts++;
          const px = Math.floor(Math.random() * tileW),
            py = Math.floor(Math.random() * tileH),
            index = (py * tileW + px) * 4,
            r = pixels[index] / 255,
            g = pixels[index + 1] / 255,
            b = pixels[index + 2] / 255,
            light = r * 0.2126 + g * 0.7152 + b * 0.0722,
            saturation = Math.max(r, g, b) - Math.min(r, g, b);
          if (Math.random() > 0.12 + light * 0.58 + saturation * 0.42) continue;
          const u = px / tileW,
            v = py / tileH,
            j = written * 3;
          pos[j] = (u - 0.5) * 5.15;
          pos[j + 1] = (0.5 - v) * 3.45;
          pos[j + 2] = (light - 0.5) * 0.48 + (Math.random() - 0.5) * 0.045;
          colors[j] = r;
          colors[j + 1] = g;
          colors[j + 2] = b;
          seeds[written] = Math.random();
          written++;
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute(
          "position",
          new THREE.BufferAttribute(pos.slice(0, written * 3), 3),
        );
        geo.setAttribute(
          "color",
          new THREE.BufferAttribute(colors.slice(0, written * 3), 3),
        );
        geo.setAttribute(
          "aSeed",
          new THREE.BufferAttribute(seeds.slice(0, written), 1),
        );
        geo.computeBoundingSphere();
        const material = new THREE.ShaderMaterial({
          uniforms: {
            ...this.uniforms,
            uFocus: { value: 0 },
            uMode: { value: tile % 3 },
            uOpacity: { value: 0 },
          },
          vertexShader: pngPointVertex,
          fragmentShader: pngPointFragment,
          vertexColors: true,
          transparent: true,
          depthWrite: false,
          blending:
            tile % 4 === 0 ? THREE.AdditiveBlending : THREE.NormalBlending,
          toneMapped: true,
        });
        const cloud = new THREE.Points(geo, material);
        cloud.userData = {
          baseZ: depths[tile],
          name: names[tile],
          seed: tile * 0.73,
          restX: (tile % 2 ? 1 : -1) * (0.42 + (tile % 3) * 0.24),
          restY: ((tile % 3) - 1) * 0.22,
        };
        cloud.position.set(
          Number(cloud.userData.restX),
          Number(cloud.userData.restY),
          depths[tile],
        );
        cloud.scale.setScalar(0.16);
        this.root.add(cloud);
        this.pngClouds.push(cloud);
      }
    };
  }

  private makeWorldShells() {
    this.syncWorldShells();
  }

  private syncWorldShells() {
    this.worldShellSpecs.forEach(([url, baseZ, baseRotation], i) => {
      const focusDepth = -baseZ - 4,
        raw = Math.abs(this.depth - focusDepth),
        distance = Math.min(raw, ARCHIVE_DEPTH - raw),
        existing = this.worldShells.find(
          (shell) => shell.userData.shellIndex === i,
        );
      if (distance < 10 && !existing && !this.worldShellLoading.has(i)) {
        this.worldShellLoading.add(i);
        new RGBELoader().load(
          url,
          (texture) => {
            this.worldShellLoading.delete(i);
            const nowRaw = Math.abs(this.depth - focusDepth),
              nowDistance = Math.min(nowRaw, ARCHIVE_DEPTH - nowRaw);
            if (nowDistance >= 13) {
              texture.dispose();
              return;
            }
            texture.mapping = THREE.EquirectangularReflectionMapping;
            texture.minFilter = THREE.LinearFilter;
            texture.magFilter = THREE.LinearFilter;
            texture.generateMipmaps = false;
            const geometry = new THREE.SphereGeometry(18, 96, 48),
              material = new THREE.MeshBasicMaterial({
                map: texture,
                color: i === 0 ? 0xb8c3d5 : i === 1 ? 0xb6a990 : 0xa39a91,
                side: THREE.BackSide,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                depthTest: false,
                toneMapped: true,
              }),
              shell = new THREE.Mesh(geometry, material);
            shell.renderOrder = -100;
            shell.userData = {
              baseZ,
              seed: i * 2.7,
              baseRotation,
              shellIndex: i,
            };
            shell.position.z = baseZ;
            shell.rotation.y = baseRotation;
            this.root.add(shell);
            this.worldShells.push(shell);
          },
          undefined,
          () => this.worldShellLoading.delete(i),
        );
      } else if (distance > 13 && existing) {
        this.root.remove(existing);
        existing.geometry.dispose();
        const material = existing.material as THREE.MeshBasicMaterial;
        material.map?.dispose();
        material.dispose();
        this.worldShells = this.worldShells.filter(
          (shell) => shell !== existing,
        );
      }
    });
  }

  private loadArtifacts() {
    const specs = [
      ["/models/frame.glb", "GUESTBOOK FRAME", -3.5, 3.2, false],
      ["/models/hand-phone.glb", "UNSENT DEVICE", -7.5, 3.6, false],
      ["/models/people.glb", "ORPHANED USERS", -11.5, 3.8, false],
      ["/models/sleeping-cat.glb", "IDLE USER", -15.5, 4.0, true],
      ["/models/peony-point-cloud.glb", "RECOVERED FLOWER", -21, 4.2, true],
      ["/models/tree-scan.glb", "CACHED FOREST", -25.5, 4.4, true],
      ["/models/pumpkin-point-cloud.glb", "HARVEST CACHE", -30, 4.0, true],
      ["/models/surprise-mushroom.glb", "SPORE PROTOCOL", -34.5, 4.2, true],
      ["/models/glowing-mushroom.glb", "BIOLUMINESCENT ERROR", -39, 4.0, false],
      ["/models/sheep-skull.glb", "PASTORAL REMAINS", -45, 4.0, true],
      ["/models/deity-head.glb", "LOCAL GOD", -49.5, 4.1, false],
      ["/models/magic-mandala.glb", "CIRCULAR ARGUMENT", -54, 4.5, true],
      [
        "/models/geometric-pattern.glb",
        "RECURSIVE DECORATION",
        -58.5,
        4.4,
        true,
      ],
      ["/models/heart.glb", "REACTION WITHOUT OWNER", -63, 4.2, true],
      ["/models/jellyfish.glb", "NONHUMAN MODERATOR", -68, 4.2, true],
      ["/models/pointcloud-test6.glb", "UNRESOLVED SCAN", -73, 4.5, true],
    ] as const;
    const loader = new GLTFLoader();
    specs.forEach(([url, name, z, size, particles], i) =>
      loader.load(url, (g) => {
        const model = g.scene as ArchiveObject,
          box = new THREE.Box3().setFromObject(model),
          center = box.getCenter(new THREE.Vector3()),
          dims = box.getSize(new THREE.Vector3()),
          scale = size / Math.max(...dims.toArray());
        model.position.sub(center.multiplyScalar(scale));
        model.scale.setScalar(scale);
        const smallest = Math.min(dims.x, dims.y, dims.z);
        if (smallest === dims.x) model.rotation.y = Math.PI * 0.5;
        else if (smallest === dims.y) model.rotation.x = Math.PI * 0.5;
        if (name.includes("FRAME")) model.rotation.set(0, -Math.PI * 0.5, 0);
        if (name.includes("FLOWER")) model.rotation.x -= Math.PI * 0.18;
        const fittedCenter = new THREE.Box3()
          .setFromObject(model)
          .getCenter(new THREE.Vector3());
        model.position.sub(fittedCenter);
        model.userData = { baseZ: z, drift: i * 0.31, name };
        if (particles) this.particleize(model, name);
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const original = o.material as THREE.MeshStandardMaterial;
            o.material = new THREE.MeshStandardMaterial({
              color: original.color ?? new THREE.Color(0xb9c9bd),
              map: original.map ?? null,
              vertexColors: Boolean(o.geometry.getAttribute("color")),
              transparent: true,
              opacity: 1,
              roughness: 0.48,
              metalness: 0.08,
              emissive: name.includes("DEVICE") ? 0x48172d : 0x1c493d,
              emissiveIntensity: 1.25,
              wireframe: false,
              side: THREE.DoubleSide,
            });
          }
          if (o instanceof THREE.Points && !o.userData.oraclePoints) {
            const original = o.material as THREE.PointsMaterial;
            o.material = this.makePointMaterial(
              original.color ?? new THREE.Color(0xb7c8bd),
              original.map ?? null,
              this.accentFor(name),
            );
          }
        });
        const wrapper = new THREE.Group() as ArchiveObject;
        wrapper.userData = { baseZ: z, drift: i * 0.31, name };
        wrapper.position.set(0, 0, z);
        wrapper.scale.setScalar(0.025);
        wrapper.add(model);
        this.root.add(wrapper);
        this.archive.push(wrapper);
        this.artifacts.push(wrapper);
        this.artifactSet.add(wrapper);
        if (name.includes("USERS")) {
          for (let c = 0; c < 5; c++) {
            const clone = model.clone();
            clone.position.x = (c - 2) * 0.72;
            clone.position.z = -Math.abs(c - 2) * 0.22;
            clone.scale.multiplyScalar(0.78 + Math.sin(c) * 0.12);
            wrapper.add(clone);
          }
        }
        this.freezeStaticHierarchy(wrapper);
        this.scheduleShaderWarmup();
      }),
    );
  }

  private loadCompanions() {
    const specs = [
        [
          "/models/story-turnstile.glb",
          "BOOT TURNSTILE",
          -3.5,
          4.8,
          false,
          2.8,
          -0.35,
        ],
        [
          "/models/story-fallen-log.glb",
          "ROOT BRIDGE",
          -25.5,
          5.6,
          true,
          -2.9,
          -1.15,
        ],
        [
          "/models/story-sacred-script.glb",
          "SACRED SCRIPT",
          -49.5,
          5.1,
          true,
          2.9,
          0.7,
        ],
        [
          "/models/story-flower-life.glb",
          "FLOWER OF LIFE",
          -54,
          5.5,
          true,
          -2.85,
          0.15,
        ],
      ] as const,
      loader = new GLTFLoader();
    specs.forEach(([url, name, z, size, particles, targetX, targetY], i) =>
      loader.load(url, (g) => {
        const model = g.scene as ArchiveObject,
          box = new THREE.Box3().setFromObject(model),
          center = box.getCenter(new THREE.Vector3()),
          dims = box.getSize(new THREE.Vector3()),
          scale = size / Math.max(...dims.toArray());
        model.position.sub(center.multiplyScalar(scale));
        model.scale.setScalar(scale);
        const smallest = Math.min(dims.x, dims.y, dims.z);
        if (smallest === dims.x) model.rotation.y = Math.PI * 0.5;
        else if (smallest === dims.y) model.rotation.x = Math.PI * 0.5;
        const fittedCenter = new THREE.Box3()
          .setFromObject(model)
          .getCenter(new THREE.Vector3());
        model.position.sub(fittedCenter);
        if (particles) this.particleize(model, name);
        model.traverse((o) => {
          if (o instanceof THREE.Mesh) {
            const original = Array.isArray(o.material)
              ? o.material[0]
              : (o.material as THREE.MeshStandardMaterial);
            o.material = new THREE.MeshStandardMaterial({
              color: original.color ?? new THREE.Color(0x8fa18f),
              map: original.map ?? null,
              vertexColors: Boolean(o.geometry.getAttribute("color")),
              transparent: true,
              opacity: 0.58,
              roughness: 0.72,
              metalness: 0.04,
              emissive: 0x13231d,
              emissiveIntensity: 0.6,
              side: THREE.DoubleSide,
            });
          }
        });
        const wrapper = new THREE.Group() as ArchiveObject;
        wrapper.userData = {
          baseZ: z,
          drift: i * 0.41,
          name,
          isCompanion: true,
          targetX,
          targetY,
        };
        wrapper.position.set(targetX, targetY, z);
        wrapper.add(model);
        this.freezeStaticHierarchy(wrapper);
        this.root.add(wrapper);
        this.archive.push(wrapper);
        this.companions.push(wrapper);
        this.companionSet.add(wrapper);
        this.scheduleShaderWarmup();
      }),
    );
  }

  private accentFor(name: string) {
    if (name.includes("FLOWER")) return new THREE.Color(0xf078aa);
    if (name.includes("FOREST")) return new THREE.Color(0x61b875);
    if (name.includes("HARVEST")) return new THREE.Color(0xd49342);
    if (name.includes("SPORE") || name.includes("BIOLUMINESCENT"))
      return new THREE.Color(0xa86bd5);
    if (name.includes("REMAINS")) return new THREE.Color(0xc19b62);
    if (name.includes("CIRCULAR")) return new THREE.Color(0x4ed7ee);
    if (name.includes("DECORATION")) return new THREE.Color(0xe65da8);
    if (name.includes("HEART")) return new THREE.Color(0xe84c6a);
    if (name.includes("MODERATOR")) return new THREE.Color(0x58b9cf);
    if (name.includes("IDLE")) return new THREE.Color(0x74a6cf);
    return new THREE.Color(0x8a75df);
  }

  private makePointMaterial(
    _fallback: THREE.Color,
    map: THREE.Texture | null = null,
    accent = new THREE.Color(0x8a75df),
  ) {
    return new THREE.ShaderMaterial({
      uniforms: {
        ...this.uniforms,
        uMap: { value: map },
        uHasMap: { value: map ? 1 : 0 },
        uAccent: { value: accent },
      },
      vertexShader: artifactPointVertex,
      fragmentShader: artifactPointFragment,
      transparent: true,
      depthWrite: false,
      vertexColors: true,
      blending: THREE.NormalBlending,
      toneMapped: true,
    }) as THREE.ShaderMaterial;
  }

  private particleize(root: THREE.Object3D, name: string) {
    const replacements: {
      parent: THREE.Object3D;
      old: THREE.Object3D;
      points: THREE.Points;
    }[] = [];
    root.traverse((o) => {
      if (!(o instanceof THREE.Mesh) && !(o instanceof THREE.Points)) return;
      const pos = o.geometry.getAttribute("position") as
        THREE.BufferAttribute | undefined;
      if (!pos || !o.parent) return;
      const material = Array.isArray(o.material) ? o.material[0] : o.material;
      const fallback =
        (material as THREE.MeshStandardMaterial | THREE.PointsMaterial)
          ?.color ?? new THREE.Color(0xa7c6b6);
      const map =
        (material as THREE.MeshStandardMaterial | THREE.PointsMaterial)?.map ??
        null;
      let geo: THREE.BufferGeometry;
      if (o instanceof THREE.Mesh) {
        const sampler = new MeshSurfaceSampler(o).build(),
          count = Math.min(
            220000,
            Math.max(90000, Math.floor(pos.count * 4.5)),
          ),
          positions = new Float32Array(count * 3),
          colors = new Float32Array(count * 3),
          uvs = new Float32Array(count * 2),
          samplePos = new THREE.Vector3(),
          sampleNormal = new THREE.Vector3(),
          sampleColor = new THREE.Color(),
          sampleUv = new THREE.Vector2(),
          hasColor = Boolean(o.geometry.getAttribute("color"));
        for (let k = 0; k < count; k++) {
          sampler.sample(samplePos, sampleNormal, sampleColor, sampleUv);
          positions[k * 3] = samplePos.x;
          positions[k * 3 + 1] = samplePos.y;
          positions[k * 3 + 2] = samplePos.z;
          const c = hasColor ? sampleColor : fallback;
          colors[k * 3] = c.r;
          colors[k * 3 + 1] = c.g;
          colors[k * 3 + 2] = c.b;
          uvs[k * 2] = sampleUv.x;
          uvs[k * 2 + 1] = sampleUv.y;
        }
        geo = new THREE.BufferGeometry();
        geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
      } else {
        const sourceColor = o.geometry.getAttribute("color") as
            THREE.BufferAttribute | undefined,
          sourceUv = o.geometry.getAttribute("uv") as
            THREE.BufferAttribute | undefined,
          target = Math.max(pos.count, 130000);
        if (target > pos.count) {
          const positions = new Float32Array(target * 3),
            colors = new Float32Array(target * 3),
            uvs = new Float32Array(target * 2);
          o.geometry.computeBoundingBox();
          const jitter =
            (o.geometry.boundingBox?.getSize(this.projected).length() ?? 1) *
            0.0007;
          for (let k = 0; k < target; k++) {
            const source =
              k < pos.count ? k : Math.floor(Math.random() * pos.count);
            positions[k * 3] =
              pos.getX(source) + (Math.random() - 0.5) * jitter;
            positions[k * 3 + 1] =
              pos.getY(source) + (Math.random() - 0.5) * jitter;
            positions[k * 3 + 2] =
              pos.getZ(source) + (Math.random() - 0.5) * jitter;
            colors[k * 3] = sourceColor ? sourceColor.getX(source) : fallback.r;
            colors[k * 3 + 1] = sourceColor
              ? sourceColor.getY(source)
              : fallback.g;
            colors[k * 3 + 2] = sourceColor
              ? sourceColor.getZ(source)
              : fallback.b;
            uvs[k * 2] = sourceUv ? sourceUv.getX(source) : 0;
            uvs[k * 2 + 1] = sourceUv ? sourceUv.getY(source) : 0;
          }
          geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
          geo.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
        } else {
          geo = o.geometry.clone();
          if (!geo.getAttribute("color")) {
            const data = new Float32Array(pos.count * 3);
            for (let k = 0; k < pos.count; k++) {
              data[k * 3] = fallback.r;
              data[k * 3 + 1] = fallback.g;
              data[k * 3 + 2] = fallback.b;
            }
            geo.setAttribute("color", new THREE.BufferAttribute(data, 3));
          }
          if (!geo.getAttribute("uv"))
            geo.setAttribute(
              "uv",
              new THREE.BufferAttribute(new Float32Array(pos.count * 2), 2),
            );
        }
      }
      geo.computeBoundingSphere();
      const points = new THREE.Points(
        geo,
        this.makePointMaterial(fallback, map, this.accentFor(name)),
      );
      points.userData.oraclePoints = true;
      points.position.copy(o.position);
      points.quaternion.copy(o.quaternion);
      points.scale.copy(o.scale);
      points.name = o.name;
      replacements.push({ parent: o.parent, old: o, points });
    });
    replacements.forEach(({ parent, old, points }) => {
      parent.remove(old);
      parent.add(points);
    });
  }

  update(time: number, dt: number, g: Gesture, holding: boolean) {
    this.syncWorldShells();
    const excavate = Math.max(g.pinch, holding ? 1 : 0);
    let beatDistance = 99;
    for (const beat of STORY_BEATS)
      beatDistance = Math.min(beatDistance, Math.abs(this.depth - beat));
    const dwell =
        0.18 + 0.82 * THREE.MathUtils.smoothstep(beatDistance, 0.25, 2.05),
      targetSpeed = (excavate * 4.7 + g.velocity * 1.15) * dwell;
    this.speed += (targetSpeed - this.speed) * dt * 2.6;
    this.depth = (this.depth + this.speed * dt) % ARCHIVE_DEPTH;
    this.tear += (g.velocity - this.tear) * dt * 7;
    this.tear = clamp(this.tear);
    const nextChapter = Math.max(
      0,
      ACTS.findIndex((act) => this.depth < act.end),
    );
    if (nextChapter !== this.chapter) {
      this.chapter = nextChapter;
      this.onChapter?.(this.chapter, ACTS[this.chapter].name);
    }
    const act = ACTS[this.chapter],
      bg = this.scene.background as THREE.Color;
    bg.lerp(this.actBg[this.chapter], dt * 0.7);
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.color.lerp(this.actFog[this.chapter], dt * 0.7);
      this.scene.fog.density +=
        ((this.chapter === 4 ? 0.045 : 0.034) - this.scene.fog.density) *
        dt *
        0.8;
    }
    this.uniforms.uTime.value = time;
    this.uniforms.uExcavate.value = excavate;
    this.uniforms.uTear.value = this.tear;
    this.uniforms.uDepth.value = this.depth;
    (this.uniforms.uHand.value as THREE.Vector2).lerp(
      this.handTarget.set(g.x, g.y),
      0.22,
    );
    let heroStrength = 0;
    let heroName = "";
    this.artifacts.forEach((o) => {
      let z = o.userData.baseZ + this.depth;
      while (z > 3) z -= ARCHIVE_DEPTH;
      while (z < -ARCHIVE_DEPTH + 3) z += ARCHIVE_DEPTH;
      const s = focusAt(Math.abs(z + 4));
      if (s > heroStrength) {
        heroStrength = s;
        heroName = String(o.userData.name);
      }
    });
    this.uniforms.uHero.value = heroStrength;
    let worldStrength = 0;
    this.worldShells.forEach((shell, i) => {
      let z = Number(shell.userData.baseZ) + this.depth;
      while (z > 3) z -= ARCHIVE_DEPTH;
      while (z < -ARCHIVE_DEPTH + 3) z += ARCHIVE_DEPTH;
      shell.position.z = z;
      const focus = focusAt(Math.abs(z + 4)),
        material = shell.material as THREE.MeshBasicMaterial;
      worldStrength = Math.max(worldStrength, focus);
      material.opacity = focus * 0.82 * (1 - heroStrength * 0.08);
      const seed = Number(shell.userData.seed),
        breath = 1 + focus * (0.035 + Math.sin(time * 0.17 + seed) * 0.018);
      shell.scale.setScalar(breath);
      shell.rotation.y =
        Number(shell.userData.baseRotation) +
        time * (i % 2 ? -0.009 : 0.012) +
        (g.x - 0.5) * 0.24 * focus;
      shell.rotation.x =
        Math.sin(time * 0.08 + seed) * 0.025 * focus +
        (g.y - 0.5) * 0.08 * focus;
    });
    this.storyThread.position.z = this.depth;
    this.storyThread.rotation.z = Math.sin(time * 0.09) * 0.08;
    this.chapterGates.forEach((gate, i) => {
      let z = Number(gate.userData.baseZ) + this.depth;
      while (z > 3) z -= ARCHIVE_DEPTH;
      while (z < -ARCHIVE_DEPTH + 3) z += ARCHIVE_DEPTH;
      gate.position.z = z;
      const distance = Math.abs(z + 4);
      gate.visible = distance < 14;
      if (!gate.visible) return;
      const focus = focusAt(distance);
      gate.rotation.z += dt * (0.08 + i * 0.035);
      gate.rotation.x = Math.sin(time * 0.18 + i) * 0.14;
      gate.scale.setScalar(0.72 + focus * 1.55);
      (gate.material as THREE.PointsMaterial).opacity =
        focus * 0.76 * (1 - heroStrength * 0.42);
    });
    let pngHeroStrength = 0,
      pngHeroName = "";
    this.pngClouds.forEach((cloud, i) => {
      let z = Number(cloud.userData.baseZ) + this.depth;
      while (z > 3) z -= ARCHIVE_DEPTH;
      while (z < -ARCHIVE_DEPTH + 3) z += ARCHIVE_DEPTH;
      cloud.position.z = z;
      const distance = Math.abs(z + 4),
        material = cloud.material as THREE.ShaderMaterial;
      cloud.visible = distance < 17.5;
      if (!cloud.visible) {
        material.uniforms.uOpacity.value = 0;
        return;
      }
      const focus = focusAt(distance),
        seed = Number(cloud.userData.seed);
      if (focus > pngHeroStrength) {
        pngHeroStrength = focus;
        pngHeroName = String(cloud.userData.name);
      }
      material.uniforms.uFocus.value = focus;
      material.uniforms.uOpacity.value = focus * (1 - heroStrength * 0.82);
      const scale = 0.12 + focus * 1.33;
      cloud.scale.setScalar(scale);
      cloud.position.x +=
        (Number(cloud.userData.restX) * (1.05 + focus * 0.55) +
          Math.sin(time * 0.13 + seed) * (0.18 + focus * 0.25) -
          cloud.position.x) *
        dt *
        2.1;
      cloud.position.y +=
        (Number(cloud.userData.restY) * (1.15 + focus * 0.45) +
          Math.cos(time * 0.11 + seed) * (0.12 + focus * 0.16) -
          cloud.position.y) *
        dt *
        2.1;
      cloud.rotation.y = Math.sin(time * 0.09 + seed) * (0.08 + focus * 0.2);
      cloud.rotation.z = Math.sin(time * 0.07 + seed) * 0.035;
    });
    this.retroIcons.forEach((icon, i) => {
      let z = Number(icon.userData.baseZ) + this.depth;
      while (z > 3) z -= ARCHIVE_DEPTH;
      while (z < -ARCHIVE_DEPTH + 3) z += ARCHIVE_DEPTH;
      icon.position.z = z;
      icon.visible = Math.abs(z + 4) < 15;
      if (!icon.visible) return;
      const seed = Number(icon.userData.seed);
      this.projected.copy(icon.position).project(this.camera);
      const sx = this.projected.x * 0.5 + 0.5,
        sy = this.projected.y * 0.5 + 0.5;
      const dx = sx - g.x,
        dy = sy - g.y,
        near = Math.exp(-Math.hypot(dx, dy) * 11);
      const assemble =
        0.5 + 0.5 * Math.sin(time * 0.22 + Math.floor(i / 4) * 1.7);
      const push = (excavate * 0.9 + this.tear * 0.6) * near;
      icon.position.x =
        Number(icon.userData.restX) * (1 - assemble * 0.14) +
        Math.sin(time * 0.31 + seed) * (0.15 + assemble * 0.08) +
        (dx / (Math.hypot(dx, dy) + 0.03)) * push * 2.2;
      icon.position.y =
        Number(icon.userData.restY) * (1 - assemble * 0.14) +
        Math.cos(time * 0.27 + seed) * (0.12 + assemble * 0.06) +
        (dy / (Math.hypot(dx, dy) + 0.03)) * push * 1.5;
      const focus = Math.exp(-Math.abs(z + 4) * 0.48),
        size = (0.7 + focus * 1.25) * (1 + near * 0.65);
      icon.scale.setScalar(size);
      (icon.material as THREE.SpriteMaterial).opacity =
        (0.04 + focus * 0.9) * (1 - heroStrength * 0.94);
      icon.material.rotation =
        Math.sin(time * 0.18 + seed) * 0.08 + this.tear * near * 0.5;
    });
    let heroShotStrength = 0,
      heroShotX = 0,
      heroShotY = 0;
    this.archive.forEach((o, i) => {
      let z = o.userData.baseZ + this.depth;
      while (z > 3) z -= ARCHIVE_DEPTH;
      while (z < -ARCHIVE_DEPTH + 3) z += ARCHIVE_DEPTH;
      o.position.z = z;
      if (o.userData.isPage) {
        const mat = (o as THREE.Mesh).material as THREE.ShaderMaterial;
        o.visible = Math.abs(z + 3) < 15;
        if (!o.visible) {
          mat.uniforms.uOpacity.value = 0;
          return;
        }
        const side = i % 2 ? 1 : -1,
          visibility = Math.exp(-Math.abs(z + 3) * 0.58),
          fieldStrength = Math.max(heroStrength, pngHeroStrength),
          suppression = THREE.MathUtils.smoothstep(fieldStrength, 0.36, 0.7);
        o.position.x = Number(o.userData.baseX) + side * fieldStrength * 7;
        o.position.y =
          Number(o.userData.baseY) + Math.sin(i) * fieldStrength * 1.8;
        mat.uniforms.uOpacity.value =
          Math.min(1, 1.18 * visibility) * (1 - suppression);
        o.rotation.y += side * fieldStrength * dt * 1.4;
      } else if (!this.artifactSet.has(o) && !this.companionSet.has(o)) {
        o.rotation.y +=
          dt * (0.015 + Number(o.userData.drift) * 0.03) * (i % 2 ? 1 : -1);
      }
      if (this.artifactSet.has(o)) {
        const distance = Math.abs(z + 4);
        o.visible = distance < 26;
        if (!o.visible) return;
        const s = focusAt(distance),
          kind = String(o.userData.name),
          shot = ARTIFACT_SHOTS[kind] ?? {
            x: 0,
            y: 0,
            yaw: 0,
            pitch: 0,
            roll: 0,
          };
        let scale = 0.025 + s * 2.34,
          targetX = shot.x,
          targetY = shot.y;
        if (s > heroShotStrength) {
          heroShotStrength = s;
          heroShotX = targetX;
          heroShotY = targetY;
        }
        if (kind.includes("FRAME")) scale *= 1.12;
        if (kind.includes("USERS")) {
          scale *= 0.92;
        }
        if (kind.includes("FLOWER")) {
          scale *= 1.12;
        }
        if (kind.includes("FOREST")) {
          scale *= 0.66;
        }
        if (kind.includes("REMAINS")) {
          scale *= 1.45;
        }
        if (kind.includes("UNRESOLVED")) {
          targetX += Math.sin(time * 0.2) * 0.72;
          scale *= 1.12;
        }
        o.scale.setScalar(
          o.scale.x + (scale - o.scale.x) * Math.min(1, dt * 3.2),
        );
        o.position.x +=
          (targetX +
            Math.sin(time * 0.11 + i) * (0.34 - s * 0.3) -
            o.position.x) *
          dt *
          (1 + s * 1.7);
        o.position.y +=
          (targetY +
            Math.sin(time * 0.3 + i) * (0.1 + s * 0.04) -
            o.position.y) *
          dt *
          (1 + s);
        if (kind.includes("DEVICE")) {
          o.rotation.x = shot.pitch;
          o.rotation.y = shot.yaw + Math.sin(time * 0.2) * 0.16;
          o.rotation.z = shot.roll + Math.sin(time * 0.35) * 0.2;
        } else if (kind.includes("USERS"))
          o.rotation.y = shot.yaw + Math.sin(time * 0.22) * 0.34;
        else if (kind.includes("IDLE")) {
          o.rotation.y = shot.yaw + Math.sin(time * 0.15) * 0.22;
          o.rotation.x = shot.pitch;
        } else if (kind.includes("MODERATOR"))
          o.rotation.x = shot.pitch + Math.sin(time * 0.17) * 0.26;
        else if (kind.includes("FLOWER")) {
          o.rotation.z += dt * 0.17;
          o.rotation.x = shot.pitch + Math.sin(time * 0.21) * 0.12;
        } else if (kind.includes("FOREST"))
          o.rotation.y = shot.yaw + Math.sin(time * 0.1) * 0.22;
        else if (kind.includes("SPORE") || kind.includes("BIOLUMINESCENT"))
          o.rotation.y = shot.yaw + Math.sin(time * 0.18) * 0.42;
        else if (kind.includes("REMAINS")) {
          o.rotation.x = shot.pitch;
          o.rotation.y = shot.yaw + Math.sin(time * 0.28) * 0.2;
          o.rotation.z = shot.roll;
        } else if (kind.includes("GOD"))
          o.rotation.y = shot.yaw + Math.sin(time * 0.13) * 0.22;
        else if (kind.includes("CIRCULAR") || kind.includes("DECORATION")) {
          o.rotation.x = shot.pitch;
          o.rotation.y = shot.yaw;
          o.rotation.z += dt * (0.1 + s * 0.28);
        } else if (kind.includes("HEART"))
          o.rotation.y = shot.yaw + time * 0.22;
        else {
          o.rotation.x = shot.pitch;
          o.rotation.y = shot.yaw + Math.sin(time * 0.14 + i) * 0.08;
          o.rotation.z = shot.roll + Math.sin(time * 0.16) * 0.05;
        }
      }
      if (this.companionSet.has(o)) {
        const distance = Math.abs(z + 4);
        o.visible = distance < 19;
        if (!o.visible) return;
        const s = focusAt(distance),
          kind = String(o.userData.name),
          scale = 0.06 + s * 0.62;
        o.scale.setScalar(
          o.scale.x + (scale - o.scale.x) * Math.min(1, dt * 2.4),
        );
        o.position.x +=
          (Number(o.userData.targetX) * (0.82 + s * 0.5) - o.position.x) *
          dt *
          1.8;
        o.position.y += (Number(o.userData.targetY) - o.position.y) * dt * 1.8;
        if (kind.includes("TURNSTILE"))
          o.rotation.y = -0.42 + Math.sin(time * 0.12) * 0.08;
        else if (kind.includes("ROOT"))
          o.rotation.y = Math.sin(time * 0.08) * 0.16;
        else {
          o.rotation.x = 0;
          o.rotation.y = 0;
          o.rotation.z += dt * (0.04 + s * 0.12);
        }
      }
    });
    const narrativeStrength = Math.max(heroStrength, pngHeroStrength),
      narrativeName =
        pngHeroStrength > heroStrength * 1.08 ? pngHeroName : heroName;
    if (narrativeStrength > 0.48 && narrativeName !== this.activeArtifact) {
      this.activeArtifact = narrativeName;
      this.onArtifact?.(narrativeName, this.chapter);
    } else if (narrativeStrength < 0.16) this.activeArtifact = "";
    const cameraDrift = Math.sin(time * 0.075 + this.chapter * 1.7) * 0.32;
    this.camera.position.x +=
      ((g.x - 0.5) * 1.75 + cameraDrift - this.camera.position.x) * dt * 1.35;
    this.camera.position.y +=
      ((g.y - 0.5) * 1.05 +
        Math.sin(time * 0.052) * 0.12 -
        this.camera.position.y) *
      dt *
      1.35;
    this.camera.rotation.z +=
      ((g.x - 0.5) * -0.035 - this.camera.rotation.z) * dt * 2;
    this.camera.fov +=
      (54 + worldStrength * (9 + excavate * 4) - this.camera.fov) * dt * 1.5;
    this.camera.updateProjectionMatrix();
    this.camera.lookAt(
      this.camera.position.x * 0.12 + heroShotX * heroShotStrength * 0.08,
      this.camera.position.y * 0.1 + heroShotY * heroShotStrength * 0.22,
      -7,
    );
    this.afterimage.uniforms.damp.value =
      (this.chapter === 4 ? 0.9 : 0.84) - this.tear * 0.16 - excavate * 0.05;
    this.distortion.uniforms.uTime.value = time;
    this.distortion.uniforms.uTear.value = this.tear;
    this.distortion.uniforms.uCurve.value = act.curve + excavate * 0.2;
    this.distortion.uniforms.uHand.value.copy(this.uniforms.uHand.value);
    this.composer.render();
  }

  private resize = () => {
    this.renderer.setSize(innerWidth, innerHeight, false);
    this.composer.setSize(innerWidth, innerHeight);
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  };
}
