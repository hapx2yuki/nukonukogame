import "./style.css";
import { AudioEngine } from "./game/AudioEngine";
import { Game } from "./game/Game";
import {
  ACTION_LABELS,
  BINDABLE_ACTIONS,
  bindingLabel,
  type BindableAction,
} from "./game/Input";
import { getStoredValue, setStoredValue } from "./game/Storage";

function byId<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`Missing element #${id}`);
  return found as T;
}

const titleScreen = byId<HTMLElement>("title-screen");
const gameScreen = byId<HTMLElement>("game-screen");
const canvas = byId<HTMLCanvasElement>("game-canvas");
const howtoDialog = byId<HTMLDialogElement>("howto-dialog");
const keybindDialog = byId<HTMLDialogElement>("keybind-dialog");
const keybindList = byId<HTMLDivElement>("keybind-list");
const keybindStatus = byId<HTMLParagraphElement>("keybind-status");
const soundButton = byId<HTMLButtonElement>("sound-button");
const pauseSoundButton = byId<HTMLButtonElement>("pause-sound");
const shakeButton = byId<HTMLButtonElement>("shake-toggle");
const flashButton = byId<HTMLButtonElement>("flash-toggle");
const fullscreenButton = byId<HTMLButtonElement>("fullscreen-button");
const audio = new AudioEngine();

let soundEnabled = getStoredValue("bishoujo-n-sound", "on") !== "off";
let shakeEnabled = getStoredValue("bishoujo-n-shake", "on") !== "off";
let flashesEnabled = getStoredValue("bishoujo-n-flashes", "on") !== "off";
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

interface BindingCapture {
  action: BindableAction;
  slot: number;
  button: HTMLButtonElement;
}

let bindingCapture: BindingCapture | null = null;

function appendPrompt(container: HTMLElement, labels: string[], suffix: string): void {
  container.replaceChildren();
  labels.forEach((label) => {
    const key = document.createElement("kbd");
    key.textContent = label;
    container.append(key);
  });
  container.append(document.createTextNode(` ${suffix}`));
}

function syncControlPrompts(): void {
  const bindings = game.getBindings();
  const primary = (action: BindableAction) => bindingLabel(bindings[action][0] ?? bindings[action][1]);
  document.querySelectorAll<HTMLElement>("[data-key-for]").forEach((key) => {
    const action = key.dataset.keyFor as BindableAction | undefined;
    if (action && BINDABLE_ACTIONS.includes(action)) key.textContent = primary(action);
  });
  document.querySelectorAll<HTMLElement>("[data-prompt-action]").forEach((prompt) => {
    const action = prompt.dataset.promptAction;
    if (action === "move") {
      appendPrompt(prompt, [primary("left"), primary("right")], "移動");
    } else if (action && BINDABLE_ACTIONS.includes(action as BindableAction)) {
      const bindable = action as BindableAction;
      appendPrompt(prompt, [primary(bindable)], ACTION_LABELS[bindable]);
    }
  });
}

function stopBindingCapture(message?: string): void {
  bindingCapture?.button.classList.remove("is-listening");
  bindingCapture = null;
  keybindDialog.classList.remove("is-capturing");
  if (message) keybindStatus.textContent = message;
}

function beginBindingCapture(action: BindableAction, slot: number, button: HTMLButtonElement): void {
  stopBindingCapture();
  bindingCapture = { action, slot, button };
  button.classList.add("is-listening");
  keybindDialog.classList.add("is-capturing");
  keybindStatus.textContent = `${ACTION_LABELS[action]}：キーを押すか、空いている場所でマウスボタンを押してください。Escで取消、Deleteで解除。`;
}

function renderKeybinds(): void {
  const bindings = game.getBindings();
  keybindList.replaceChildren();

  BINDABLE_ACTIONS.forEach((action) => {
    const row = document.createElement("div");
    row.className = "keybind-row";

    const actionName = document.createElement("strong");
    actionName.textContent = ACTION_LABELS[action];
    row.append(actionName);

    bindings[action].forEach((code, slot) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "keybind-binding";
      button.textContent = bindingLabel(code);
      button.dataset.action = action;
      button.dataset.slot = String(slot);
      button.setAttribute("aria-label", `${ACTION_LABELS[action]}の${slot === 0 ? "主" : "副"}入力。現在は${bindingLabel(code)}。変更する`);
      button.addEventListener("click", () => beginBindingCapture(action, slot, button));
      row.append(button);
    });

    keybindList.append(row);
  });
  syncControlPrompts();
}

function applyCapturedBinding(code: string): void {
  if (!bindingCapture) return;
  const { action, slot } = bindingCapture;
  const result = game.setBinding(action, slot, code);
  if (!result.ok) {
    keybindStatus.textContent = result.message ?? "この入力は割り当てられません";
    return;
  }
  const swapped = result.swappedAction ? `。${ACTION_LABELS[result.swappedAction]}の割り当てと入れ替えました` : "";
  stopBindingCapture(`${ACTION_LABELS[action]}を「${bindingLabel(code)}」に変更しました${swapped}`);
  renderKeybinds();
}

function openKeybindDialog(): void {
  if (keybindDialog.open) return;
  stopBindingCapture("割り当ては自動保存されます。");
  if (gameScreen.classList.contains("is-active")) game.pauseForSettings();
  game.setInputSuspended(true);
  renderKeybinds();
  keybindDialog.showModal();
}

window.addEventListener("keydown", (event) => {
  if (!bindingCapture || event.repeat) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  if (event.code === "Escape") {
    stopBindingCapture("変更を取り消しました。");
    return;
  }
  if (event.code === "Backspace" || event.code === "Delete") {
    const { action, slot } = bindingCapture;
    const result = game.clearBinding(action, slot);
    if (!result.ok) {
      keybindStatus.textContent = result.message ?? "この割り当ては解除できません";
      return;
    }
    stopBindingCapture(`${ACTION_LABELS[action]}の入力を1つ解除しました。`);
    renderKeybinds();
    return;
  }
  applyCapturedBinding(event.code);
}, true);

window.addEventListener("pointerdown", (event) => {
  if (!bindingCapture || event.pointerType !== "mouse") return;
  const target = event.target as Element | null;
  if (target?.closest("button")) return;
  event.preventDefault();
  event.stopImmediatePropagation();
  applyCapturedBinding(`Mouse${event.button}`);
}, true);

keybindDialog.addEventListener("contextmenu", (event) => event.preventDefault());
keybindDialog.addEventListener("close", () => {
  stopBindingCapture();
  game.setInputSuspended(false);
  syncControlPrompts();
  if (gameScreen.classList.contains("is-active")) {
    window.setTimeout(() => byId<HTMLButtonElement>("resume-button").focus(), 50);
  } else {
    window.setTimeout(() => byId<HTMLButtonElement>("keybind-button").focus(), 50);
  }
});

function syncSettings(): void {
  soundButton.textContent = soundEnabled ? "音 ON" : "音 OFF";
  soundButton.setAttribute("aria-pressed", String(!soundEnabled));
  pauseSoundButton.textContent = soundEnabled ? "ON" : "OFF";
  shakeButton.textContent = shakeEnabled ? "標準" : "なし";
  flashButton.textContent = flashesEnabled ? "標準" : "低減";
}

function toggleSound(): void {
  soundEnabled = !soundEnabled;
  setStoredValue("bishoujo-n-sound", soundEnabled ? "on" : "off");
  audio.setMuted(!soundEnabled);
  if (soundEnabled) void audio.start().catch(() => undefined);
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

function startGame(): void {
  if (gameStartPending) return;
  gameStartPending = true;
  showGame();
  const debugMode = new URLSearchParams(window.location.search).has("debug");
  try {
    if (!debugMode) void audio.start().catch(() => undefined);
    void enterMobileFullscreen();
    game.start();
  } finally {
    gameStartPending = false;
  }
}

byId<HTMLButtonElement>("start-button").addEventListener("click", () => void startGame());
byId<HTMLButtonElement>("howto-button").addEventListener("click", () => howtoDialog.showModal());
byId<HTMLButtonElement>("keybind-button").addEventListener("click", openKeybindDialog);
byId<HTMLButtonElement>("keybind-game-button").addEventListener("click", openKeybindDialog);
byId<HTMLButtonElement>("pause-keybind-button").addEventListener("click", openKeybindDialog);
byId<HTMLButtonElement>("reset-keybinds-button").addEventListener("click", () => {
  game.resetBindings();
  stopBindingCapture("初期配置へ戻しました。");
  renderKeybinds();
});
soundButton.addEventListener("click", toggleSound);
pauseSoundButton.addEventListener("click", toggleSound);
byId<HTMLButtonElement>("pause-button").addEventListener("click", () => game.togglePause());
byId<HTMLButtonElement>("resume-button").addEventListener("click", () => game.resume());
byId<HTMLButtonElement>("title-button").addEventListener("click", () => game.returnToTitle());
byId<HTMLButtonElement>("result-title-button").addEventListener("click", () => game.returnToTitle());
byId<HTMLButtonElement>("retry-button").addEventListener("click", () => void startGame());

shakeButton.addEventListener("click", () => {
  shakeEnabled = !shakeEnabled;
  setStoredValue("bishoujo-n-shake", shakeEnabled ? "on" : "off");
  game.setShakeEnabled(shakeEnabled);
  syncSettings();
});

flashButton.addEventListener("click", () => {
  flashesEnabled = !flashesEnabled;
  setStoredValue("bishoujo-n-flashes", flashesEnabled ? "on" : "off");
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
  const dialogOpen = keybindDialog.open || howtoDialog.open;
  if (titleScreen.classList.contains("is-active") && !dialogOpen && startPressed && !titleGamepadHeld) void startGame();
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

document.addEventListener("pointerdown", () => void audio.start().catch(() => undefined), { once: true });
document.addEventListener("visibilitychange", () => {
  audio.setPageHidden(document.hidden);
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
syncControlPrompts();
pollTitleGamepad();
