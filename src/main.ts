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
let gameStartPending = false;
let titleGamepadHeld = false;
audio.setMuted(!soundEnabled);

function showTitle(): void {
  document.body.classList.remove("game-active");
  document.body.classList.remove("mobile-immersive");
  gameScreen.classList.remove("is-active");
  titleScreen.classList.add("is-active");
  if (document.fullscreenElement === gameScreen) void document.exitFullscreen().catch(() => undefined);
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

function isMobilePlayDevice(): boolean {
  return navigator.maxTouchPoints > 0 || matchMedia("(pointer: coarse)").matches || matchMedia("(hover: none) and (any-pointer: coarse)").matches;
}

async function enterMobileFullscreen(): Promise<void> {
  if (!isMobilePlayDevice() || document.fullscreenElement === gameScreen) return;
  try {
    await gameScreen.requestFullscreen();
    document.body.classList.remove("mobile-immersive");
    await lockLandscapeOrientation();
  } catch {
    // iOSなど任意要素の全画面化に未対応の端末では、画面内を最大化する代替表示にする。
    document.body.classList.add("mobile-immersive");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
}

async function startGame(): Promise<void> {
  if (gameStartPending) return;
  gameStartPending = true;
  showGame();
  const debugMode = new URLSearchParams(window.location.search).has("debug");
  const soundReady = debugMode ? Promise.resolve() : audio.start();
  const fullscreenReady = enterMobileFullscreen();
  try {
    await Promise.allSettled([soundReady, fullscreenReady]);
    game.start();
  } finally {
    gameStartPending = false;
  }
}

byId<HTMLButtonElement>("start-button").addEventListener("click", () => void startGame());
byId<HTMLButtonElement>("howto-button").addEventListener("click", () => howtoDialog.showModal());
soundButton.addEventListener("click", toggleSound);
pauseSoundButton.addEventListener("click", toggleSound);
byId<HTMLButtonElement>("pause-button").addEventListener("click", () => game.togglePause());
byId<HTMLButtonElement>("resume-button").addEventListener("click", () => game.resume());
byId<HTMLButtonElement>("title-button").addEventListener("click", () => game.returnToTitle());
byId<HTMLButtonElement>("result-title-button").addEventListener("click", () => game.returnToTitle());
byId<HTMLButtonElement>("retry-button").addEventListener("click", () => void startGame());

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
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      document.body.classList.remove("mobile-immersive");
    }
    else {
      await gameScreen.requestFullscreen();
      document.body.classList.remove("mobile-immersive");
      await lockLandscapeOrientation();
    }
  } catch {
    byId<HTMLElement>("aria-live").textContent = "この端末では全画面表示を利用できません";
  }
});
document.addEventListener("fullscreenchange", () => {
  game.releaseInputs();
  syncFullscreenButton();
});

const preventGameSelection = (event: Event) => {
  if (document.body.classList.contains("game-active")) event.preventDefault();
};
gameScreen.addEventListener("selectstart", preventGameSelection);
gameScreen.addEventListener("dragstart", preventGameSelection);
gameScreen.addEventListener("contextmenu", preventGameSelection);

function pollTitleGamepad(): void {
  const pad = Array.from(navigator.getGamepads?.() ?? []).find((candidate): candidate is Gamepad => Boolean(candidate?.connected));
  const startPressed = Boolean(pad?.buttons[0]?.pressed || pad?.buttons[9]?.pressed);
  if (titleScreen.classList.contains("is-active") && startPressed && !titleGamepadHeld) void startGame();
  titleGamepadHeld = startPressed;
  window.requestAnimationFrame(pollTitleGamepad);
}

window.addEventListener("gamepadconnected", (event) => {
  byId<HTMLElement>("aria-live").textContent = `${event.gamepad.id || "ゲームパッド"}を接続しました。AまたはSTARTで開始できます`;
});
window.addEventListener("gamepaddisconnected", () => {
  game.releaseInputs();
  byId<HTMLElement>("aria-live").textContent = "ゲームパッドの接続が解除されました";
});

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
pollTitleGamepad();
