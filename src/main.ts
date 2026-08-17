import "./styles.css";
import { OracleWorld } from "./OracleWorld";
import { HandTracker } from "./tracking";
import { DEFAULT_GESTURE, type Gesture } from "./types";

const canvas = document.querySelector<HTMLCanvasElement>("#world")!;
const boot = document.querySelector<HTMLElement>("#boot")!;
const enter = document.querySelector<HTMLButtonElement>("#enter")!;
const vision = document.querySelector<HTMLButtonElement>("#vision")!;
const depthEl = document.querySelector<HTMLElement>("#depth")!;
const artifactEl = document.querySelector<HTMLElement>("#artifact")!;
const oracle = document.querySelector<HTMLElement>("#oracle")!;
const cursor = document.querySelector<HTMLElement>("#cursor")!;
const signal = document.querySelector<HTMLElement>("#signal")!;
const instructions = document.querySelector<HTMLElement>("#instructions")!;

const world = new OracleWorld(canvas);
let gesture: Gesture = { ...DEFAULT_GESTURE };
let cameraGesture: Gesture | null = null;
let holding = false;
let entered = false;
let last = { x: 0.5, y: 0.5, t: performance.now() };
let audio: AudioContext | null = null;
let noiseGain: GainNode | null = null;
let storyCursor = 0;
let oracleInteractions = 0;
let oracleInterval = 5;
let oracleGeneration = 0;
let lastTrackedPinch = false;
const actVoices = [
  ["borrowed weather", "soft ruins", "ghost pollen"],
  ["unowned light", "salt memory", "sleeping glass"],
  ["machine moss", "root static", "green afterimage"],
  ["empty devotion", "violet remainder", "ritual dust"],
  ["signal ash", "after us", "still becoming"],
];
const actPalette = [
  ["#a9ded0", "#c4a56a"],
  ["#d7a06c", "#82adc1"],
  ["#a9d878", "#df8caa"],
  ["#c99bea", "#6bd3dc"],
  ["#77cbed", "#d06d9c"],
] as const;
type OracleKind = "artifact" | "whisper";

const tracker = new HandTracker((g) => {
  cameraGesture = g;
});

const hashText = (value: string) =>
  [...value].reduce(
    (sum, char) => ((sum << 5) - sum + char.charCodeAt(0)) | 0,
    17,
  ) >>> 0;
const clearOracle = () => {
  oracleGeneration++;
  oracle.replaceChildren();
};
const playKeySound = (erasing = false) => {
  if (!audio) return;
  const length = Math.floor(audio.sampleRate * 0.022),
    buffer = audio.createBuffer(1, length, audio.sampleRate),
    data = buffer.getChannelData(0),
    source = audio.createBufferSource(),
    filter = audio.createBiquadFilter(),
    gain = audio.createGain();
  for (let i = 0; i < length; i++)
    data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3);
  source.buffer = buffer;
  filter.type = "bandpass";
  filter.frequency.value = erasing ? 680 : 1450;
  filter.Q.value = erasing ? 1.8 : 3.2;
  gain.gain.value = erasing ? 0.035 : 0.022;
  source.connect(filter).connect(gain).connect(audio.destination);
  source.start();
};
const showOracle = (kind: OracleKind = "artifact", label = "") => {
  const sequence = actVoices[world.chapter] ?? actVoices[0],
    message = sequence[storyCursor++ % sequence.length],
    seed = hashText(`${message}${label}${storyCursor}`),
    entry = document.createElement("section"),
    phrase = document.createElement("p"),
    palette = actPalette[world.chapter] ?? actPalette[0],
    token = ++oracleGeneration,
    x =
      kind === "whisper"
        ? Math.min(70, Math.max(20, last.x * 100))
        : 24 + (seed % 4) * 15,
    y =
      kind === "whisper"
        ? Math.min(76, Math.max(22, (1 - last.y) * 100))
        : 26 + (Math.floor(seed / 7) % 3) * 22;
  oracle.replaceChildren();
  entry.className = `oracle-entry ${kind}`;
  entry.style.setProperty("--ink", palette[0]);
  entry.style.setProperty("--echo", palette[1]);
  entry.style.setProperty("--anchor-x", `${x}%`);
  entry.style.setProperty("--anchor-y", `${y}%`);
  entry.append(phrase);
  oracle.append(entry);

  const characters = [...message],
    glyphs: HTMLSpanElement[] = [];
  let index = 0;
  const erase = () => {
    if (token !== oracleGeneration || !entry.isConnected) return;
    const glyph = glyphs.pop();
    if (!glyph) {
      entry.classList.add("spent");
      setTimeout(() => token === oracleGeneration && entry.remove(), 700);
      return;
    }
    glyph.classList.add("erase");
    if (glyph.textContent?.trim()) playKeySound(true);
    setTimeout(() => glyph.remove(), 105);
    setTimeout(erase, glyph.textContent?.trim() ? 92 : 45);
  };
  const type = () => {
    if (token !== oracleGeneration || !entry.isConnected) return;
    if (index >= characters.length) {
      setTimeout(erase, 2200);
      return;
    }
    const character = characters[index++],
      glyph = document.createElement("span"),
      glyphSeed = hashText(`${character}${index}${seed}`);
    glyph.textContent = character === " " ? "\u00a0" : character;
    glyph.dataset.char = character;
    glyph.style.setProperty("--tilt", `${(glyphSeed % 16) - 8}deg`);
    glyph.style.setProperty("--depth", `${(glyphSeed % 44) - 22}px`);
    phrase.append(glyph);
    glyphs.push(glyph);
    if (character !== " ") playKeySound();
    setTimeout(type, character === " " ? 150 : 82 + (glyphSeed % 76));
  };
  setTimeout(type, 320);
};
const tryOracle = (kind: OracleKind = "artifact", label = "") => {
  oracleInteractions++;
  if (oracleInteractions < oracleInterval) return;
  oracleInteractions = 0;
  oracleInterval = 4 + (hashText(`${label}${storyCursor}`) % 2);
  showOracle(kind, label);
};
world.onArtifact = (name, chapter) => {
  artifactEl.textContent = "";
  if (entered) tryOracle("artifact", name);
};
world.onChapter = () => {
  artifactEl.textContent = "";
  clearOracle();
};

const startAudio = () => {
  if (audio) return;
  audio = new AudioContext();
  const buffer = audio.createBuffer(1, audio.sampleRate * 2, audio.sampleRate),
    data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++)
    data[i] = (Math.random() * 2 - 1) * (0.4 + Math.sin(i * 0.003) * 0.3);
  const src = audio.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  const filter = audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 560;
  filter.Q.value = 7;
  noiseGain = audio.createGain();
  noiseGain.gain.value = 0.025;
  src.connect(filter).connect(noiseGain).connect(audio.destination);
  src.start();
};

const move = (e: PointerEvent) => {
  const now = performance.now(),
    x = e.clientX / innerWidth,
    y = 1 - e.clientY / innerHeight,
    dt = Math.max(0.016, (now - last.t) / 1000);
  gesture = {
    ...gesture,
    x,
    y,
    velocity: Math.min(1, Math.hypot(x - last.x, y - last.y) / dt / 2),
    pinch: holding ? 1 : 0,
    openness: holding ? 0.15 : 0.78,
    hands: 1,
  };
  last = { x, y, t: now };
  cursor.style.setProperty("--x", `${e.clientX}px`);
  cursor.style.setProperty("--y", `${e.clientY}px`);
};
addEventListener("pointermove", move);
addEventListener("pointerdown", (e) => {
  holding = true;
  move(e);
  startAudio();
  if (entered) tryOracle("whisper");
});
addEventListener("pointerup", (e) => {
  holding = false;
  move(e);
});
addEventListener(
  "wheel",
  (e) => {
    gesture.pinch = Math.min(1, Math.abs(e.deltaY) / 500);
    setTimeout(() => (gesture.pinch = 0), 180);
  },
  { passive: true },
);

enter.addEventListener("click", () => {
  entered = true;
  boot.classList.add("gone");
  instructions.classList.add("show");
  startAudio();
  if ("speechSynthesis" in window) speechSynthesis.cancel();
  setTimeout(() => instructions.classList.remove("show"), 5000);
});
vision.addEventListener("click", async () => {
  vision.disabled = true;
  vision.textContent = "OPENING CAMERA";
  try {
    await tracker.start();
    vision.textContent = "HAND SIGNAL ACTIVE";
    signal.textContent = "CAMERA SIGNAL";
    document.body.classList.add("hands-on");
  } catch {
    vision.disabled = false;
    vision.textContent = "CAMERA BLOCKED · USE MOUSE";
  }
});

let lastTime = performance.now();
const frame = (now: number) => {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (cameraGesture?.hands) {
    gesture = cameraGesture;
    holding = cameraGesture.pinch > 0.58;
    cursor.style.setProperty("--x", `${gesture.x * innerWidth}px`);
    cursor.style.setProperty("--y", `${(1 - gesture.y) * innerHeight}px`);
    signal.textContent = `${gesture.hands} HAND${gesture.hands > 1 ? "S" : ""} · SIGNAL`;
    const trackedPinch = cameraGesture.pinch > 0.72;
    if (entered && trackedPinch && !lastTrackedPinch) tryOracle("whisper");
    lastTrackedPinch = trackedPinch;
  } else {
    lastTrackedPinch = false;
    gesture.velocity *= Math.pow(0.04, dt);
    gesture.pinch = holding ? 1 : 0;
    if (document.body.classList.contains("hands-on"))
      signal.textContent = "SEARCHING · MOUSE FALLBACK";
  }
  if (entered) world.update(now / 1000, dt, gesture, holding);
  else
    world.update(now / 1000, dt, { ...gesture, velocity: 0, pinch: 0 }, false);
  depthEl.textContent = `DEPTH ${Math.floor(world.depth * 137)
    .toString()
    .padStart(4, "0")}`;
  cursor.dataset.mode =
    world.tear > 0.42 ? "TEAR" : holding ? "DESCEND" : "SEARCH";
  if (noiseGain && audio)
    noiseGain.gain.setTargetAtTime(
      0.018 + world.tear * 0.07 + (holding ? 0.025 : 0),
      audio.currentTime,
      0.08,
    );
  requestAnimationFrame(frame);
};
requestAnimationFrame(frame);
