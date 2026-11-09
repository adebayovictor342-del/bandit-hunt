"use client";

export type GameSound = "rifle-shot" | "drone-hit" | "fighter-hit" | "dagger-throw" | "missile-launch" | "explosion";

const AMBIENT = [
  { file: "city-street-ambience.mp3", volume: 0.32 },
  { file: "passing-cars.mp3", volume: 0.24 },
  { file: "helicopter-loop.mp3", volume: 0.18 },
] as const;
const ONE_SHOTS = {
  "market-hawker": { file: "market-hawker.mp3", volume: 0.56 },
  "danfo-conductor": { file: "danfo-conductor.mp3", volume: 0.62 },
  "rifle-shot": { file: "rifle-shot.wav", volume: 0.42 },
  "drone-hit": { file: "drone-hit.wav", volume: 0.52 },
  "fighter-hit": { file: "fighter-hit.wav", volume: 0.5 },
  "dagger-throw": { file: "dagger-throw.wav", volume: 0.45 },
  "missile-launch": { file: "missle-launch.wav", volume: 0.52 },
  explosion: { file: "explosion impact, missle and bomb impact.wav", volume: 0.55 },
} as const;
type OneShot = keyof typeof ONE_SHOTS;

const ambientAudio = new Map<string, HTMLAudioElement>();
const oneShotPools = new Map<OneShot, HTMLAudioElement[]>();
const lastPlayed = new Map<OneShot, number>();
const warnedFiles = new Set<string>();
const AUDIO_FILES = [
  ...AMBIENT.map((track) => track.file),
  ...Object.entries(ONE_SHOTS)
    .filter(([name]) => name !== "danfo-conductor")
    .map(([, sound]) => sound.file),
];
const preloadedAudio = new Map<string, HTMLAudioElement>();
let enabled = false;
let cityVisible = false;
let gameAudioReady = false;
let voiceTimer = 0;
let nextVoice = 0;
let preloadPromise: Promise<void> | null = null;

function audioFor(file: string, loop: boolean, volume: number, cache = true) {
  const cached = cache ? preloadedAudio.get(file) : undefined;
  if (cached) {
    cached.loop = loop;
    cached.volume = volume;
    return cached;
  }
  const audio = new Audio(`/audio/${file}`);
  audio.preload = "auto";
  audio.loop = loop;
  audio.volume = volume;
  audio.addEventListener("error", () => {
    if (warnedFiles.has(file)) return;
    warnedFiles.add(file);
    console.warn(`Game audio asset unavailable: public/audio/${file}`);
  });
  if (cache) preloadedAudio.set(file, audio);
  return audio;
}

function waitForAudio(audio: HTMLAudioElement, file: string) {
  if (audio.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    let timeout = 0;
    const cleanup = () => {
      window.clearTimeout(timeout);
      audio.removeEventListener("loadeddata", loaded);
      audio.removeEventListener("error", failed);
    };
    const loaded = () => { cleanup(); resolve(); };
    const failed = () => {
      cleanup();
      reject(new Error(`Could not load required game sound: public/audio/${file}`));
    };
    audio.addEventListener("loadeddata", loaded, { once: true });
    audio.addEventListener("error", failed, { once: true });
    timeout = window.setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out loading required game sound: public/audio/${file}`));
    }, 45_000);
    audio.load();
  });
}

/** Resolve only after every bundled gameplay and city sound is decoded enough to play. */
export function preloadGameAudio() {
  if (typeof window === "undefined") return Promise.resolve();
  if (!preloadPromise) {
    preloadPromise = Promise.all(AUDIO_FILES.map((file) => {
      const ambient = AMBIENT.find((track) => track.file === file);
      const oneShot = Object.values(ONE_SHOTS).find((sound) => sound.file === file);
      const audio = audioFor(file, Boolean(ambient), ambient?.volume ?? oneShot?.volume ?? 1);
      return waitForAudio(audio, file).catch((error: unknown) => {
        preloadedAudio.delete(file);
        throw error;
      });
    })).then(() => {
      for (const track of AMBIENT) {
        const audio = preloadedAudio.get(track.file);
        if (audio) ambientAudio.set(track.file, audio);
      }
      for (const [name, sound] of Object.entries(ONE_SHOTS)) {
        if (name === "danfo-conductor") continue;
        const first = preloadedAudio.get(sound.file);
        if (first) oneShotPools.set(name as OneShot, [first, audioFor(sound.file, false, sound.volume, false), audioFor(sound.file, false, sound.volume, false)]);
      }
      syncCityAudio();
    }).catch((error: unknown) => {
      preloadPromise = null;
      throw error;
    });
  }
  return preloadPromise;
}

function play(audio: HTMLAudioElement) {
  audio.play().catch(() => {});
}

function scheduleCityVoice() {
  window.clearTimeout(voiceTimer);
  if (!enabled || !cityVisible || document.hidden) return;
  voiceTimer = window.setTimeout(() => {
    const voice: OneShot = nextVoice++ % 2 === 0 ? "market-hawker" : "danfo-conductor";
    playOneShot(voice);
    scheduleCityVoice();
  }, 14000 + Math.random() * 14000);
}

function syncCityAudio() {
  if (!enabled) return;
  const shouldPlay = enabled && gameAudioReady && cityVisible && !document.hidden;
  for (const track of AMBIENT) {
    let audio = ambientAudio.get(track.file);
    if (!audio) {
      audio = audioFor(track.file, true, track.volume);
      ambientAudio.set(track.file, audio);
    }
    if (shouldPlay) play(audio);
    else audio.pause();
  }
  if (!shouldPlay) {
    for (const voice of ["market-hawker", "danfo-conductor"] as const) {
      for (const audio of oneShotPools.get(voice) ?? []) {
        audio.pause();
        audio.currentTime = 0;
      }
    }
  }
  if (shouldPlay) scheduleCityVoice();
  else window.clearTimeout(voiceTimer);
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", syncCityAudio);
}

function playOneShot(sound: OneShot) {
  if (!enabled || !gameAudioReady || document.hidden) return;
  const now = performance.now();
  const minimumGap = sound === "rifle-shot" ? 90 : sound === "dagger-throw" ? 180 : sound === "explosion" ? 350 : 130;
  if (now - (lastPlayed.get(sound) ?? -Infinity) < minimumGap) return;
  lastPlayed.set(sound, now);
  const config = ONE_SHOTS[sound];
  let pool = oneShotPools.get(sound);
  if (!pool) {
    pool = Array.from({ length: 3 }, () => audioFor(config.file, false, config.volume));
    oneShotPools.set(sound, pool);
  }
  const audio = pool.find((candidate) => candidate.paused || candidate.ended) ?? pool[0];
  audio.currentTime = 0;
  play(audio);
}

/** Call synchronously from the Play Now gesture to satisfy browser audio policies. */
export function enableGameAudio() {
  if (typeof window === "undefined") return;
  enabled = true;
  syncCityAudio();
}

/** Keep every sound silent until the city and required audio assets are ready. */
export function setGameAudioReady(ready: boolean) {
  if (typeof window === "undefined") return;
  gameAudioReady = ready;
  syncCityAudio();
}

/** City ambience follows the city renderer, including setup overlays above it. */
export function setCityAudioVisible(visible: boolean) {
  if (typeof window === "undefined") return;
  cityVisible = visible;
  syncCityAudio();
}

export function playGameSound(sound: GameSound) {
  playOneShot(sound);
}
