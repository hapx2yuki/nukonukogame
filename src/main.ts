import "./style.css";
import { AudioEngine } from "./game/AudioEngine";
import { Game } from "./game/Game";

function byId<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const titleScreen = byId<HTMLElement>("title-screen");
const gameScreen = byId<HTMLElement>("game-screen");
const canvas = byId<HTMLCanvasElement>("game-canvas");
const howtoDialog = byId<HTMLDialogElement>("howto-dialog");
const soundButton = byId<HTMLButtonElement>("sound-button");
const pauseSoundButton = byId<HTMLButtonElement>("pause-sound");
const shakeButton = byId<HTMLButtonElement>("shake-toggle");
const flashButton = byId<HTMLButtonElement>("flash-toggle");
const fullscreenButton = byId<HTMLButtonElement>("fullscreen-button");
const audio = new AudioEngine();

let soundEnabled = localStorage.getItem("bishoujo-n-sound") !== "off";
let shakeEnabled = localStorage.getItem("bishoujo-n-shake") !== "off";
let flashesEnabled = localStorage.getItem("bishoujo-n-flashes") !== "off";
audio.setMuted(!soundEnabled);

function showTitle(): void {
  document.body.classList.remove("game-active");
  gameScreen.classList.remove("is-active");
  titleScreen.classList.add("is-active");
  window.setTimeout(() => byId<HTMLButtonElement>("start-button").focus(), 350);
}

function showGame(): void {
  document.body.classList.add("game-active");
  titleScreen.classList.remove("is-active");
  gameScreen.classList.add("is-active");
  window.setTimeout(() => canvas.focus(), 350);
}

const game = new Game(canvas, audio, { onReturnToTitle: showTitle });
game.setShakeEnabled(shakeEnabled);
game.setFlashesEnabled(flashesEnabled);

function syncSettings(): void {
  soundButton.textContent = soundEnabled ? "音 ON" : "音 OFF";
  soundButton.setAttribute("aria-pressed", String(!soundEnabled));
  pauseSoundButton.textContent = soundEnabled ? "ON" : "OFF";
  shakeButton.textContent = shakeEnabled ? "標準" : "なし";
  flashButton.textContent = flashesEnabled ? "標準" : "低減";
}

function toggleSound(): void {
  soundEnabled = !soundEnabled;
  localStorage.setItem("bishoujo-n-sound", soundEnabled ? "on" : "off");
  audio.setMuted(!soundEnabled);
  if (soundEnabled) void audio.start();
  syncSettings();
}

async function startGame(): Promise<void> {
  if (new URLSearchParams(window.location.search).has("debug")) {
    showGame();
    game.start();
    return;
  }
  await audio.start();
  showGame();
  game.start();
}

byId<HTMLButtonElement>("start-button").addEventListener("click", () => void startGame());
byId<HTMLButtonElement>("howto-button").addEventListener("click", () => howtoDialog.showModal());
soundButton.addEventListener("click", toggleSound);
pauseSoundButton.addEventListener("click", toggleSound);
byId<HTMLButtonElement>("pause-button").addEventListener("click", () => game.togglePause());
byId<HTMLButtonElement>("resume-button").addEventListener("click", () => game.resume());
byId<HTMLButtonElement>("title-button").addEventListener("click", () => game.returnToTitle());
byId<HTMLButtonElement>("result-title-button").addEventListener("click", () => game.returnToTitle());
byId<HTMLButtonElement>("retry-button").addEventListener("click", () => {
  void audio.start();
  game.start();
});

shakeButton.addEventListener("click", () => {
  shakeEnabled = !shakeEnabled;
  localStorage.setItem("bishoujo-n-shake", shakeEnabled ? "on" : "off");
  game.setShakeEnabled(shakeEnabled);
  syncSettings();
});

flashButton.addEventListener("click", () => {
  flashesEnabled = !flashesEnabled;
  localStorage.setItem("bishoujo-n-flashes", flashesEnabled ? "on" : "off");
  game.setFlashesEnabled(flashesEnabled);
  syncSettings();
});

document.querySelectorAll<HTMLButtonElement>("[data-upgrade]").forEach((button) => {
  button.addEventListener("click", () => {
    const value = button.dataset.upgrade;
    if (value === "fire" || value === "bell" || value === "moon") game.selectUpgrade(value);
  });
});

window.addEventListener("keydown", (event) => {
  if (event.code === "Digit1") game.selectUpgrade("fire");
  if (event.code === "Digit2") game.selectUpgrade("bell");
  if (event.code === "Digit3") game.selectUpgrade("moon");
});

function syncFullscreenButton(): void {
  const isFullscreen = document.fullscreenElement === gameScreen;
  fullscreenButton.textContent = isFullscreen ? "全画面解除" : "全画面";
  fullscreenButton.setAttribute("aria-pressed", String(isFullscreen));
  fullscreenButton.setAttribute("aria-label", isFullscreen ? "全画面表示を解除" : "全画面で表示");
}

async function lockLandscapeOrientation(): Promise<void> {
  const orientation = screen.orientation as
    | (ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
    | undefined;
  try {
    await orientation?.lock?.("landscape");
  } catch {
    // Orientation locking is optional and unsupported on some desktop/mobile browsers.
  }
}

fullscreenButton.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await gameScreen.requestFullscreen();
      await lockLandscapeOrientation();
    }
  } catch {
    byId<HTMLElement>("aria-live").textContent = "この端末では全画面表示を利用できません";
  }
});
document.addEventListener("fullscreenchange", syncFullscreenButton);

document.addEventListener("pointerdown", () => void audio.start(), { once: true });
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) return;
  game.releaseInputs();
  if (!game.isPaused) game.togglePause();
});

const keyArt = document.querySelector<HTMLImageElement>(".key-art");
titleScreen.addEventListener("pointermove", (event) => {
  if (!keyArt || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const x = (event.clientX / window.innerWidth - 0.5) * 8;
  const y = (event.clientY / window.innerHeight - 0.5) * 5;
  keyArt.style.translate = `${x}px ${y}px`;
});
titleScreen.addEventListener("pointerleave", () => {
  if (keyArt) keyArt.style.translate = "0 0";
});

syncSettings();
syncFullscreenButton();
