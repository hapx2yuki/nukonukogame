import { getStoredValue, setStoredValue } from "./Storage";

export type Action = "left" | "right" | "down" | "jump" | "attack" | "charm" | "dash" | "ultimate" | "pause" | "confirm";

export const BINDABLE_ACTIONS = [
  "left",
  "right",
  "down",
  "jump",
  "attack",
  "charm",
  "dash",
  "ultimate",
] as const;

export type BindableAction = (typeof BINDABLE_ACTIONS)[number];
export type BindingSlots = [string | null, string | null];
export type BindingMap = Record<BindableAction, BindingSlots>;

export interface BindingChangeResult {
  ok: boolean;
  swappedAction?: BindableAction;
  message?: string;
}

export const ACTION_LABELS: Record<BindableAction, string> = {
  left: "左へ移動",
  right: "右へ移動",
  down: "しゃがむ・急降下",
  jump: "跳ぶ",
  attack: "斬撃",
  charm: "護符",
  dash: "影走り",
  ultimate: "GMK",
};

export const DEFAULT_BINDINGS: BindingMap = {
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  down: ["KeyS", "ArrowDown"],
  jump: ["Space", "KeyW"],
  attack: ["Mouse0", "KeyJ"],
  charm: ["KeyE", "KeyK"],
  dash: ["KeyC", "KeyL"],
  ultimate: ["KeyQ", "KeyV"],
};

const FIXED_KEY_BINDINGS: Record<string, Action> = {
  Escape: "pause",
  Enter: "confirm",
};

const RESERVED_BINDINGS = new Set(["Escape", "Enter", "Tab", "F5", "F11", "MetaLeft", "MetaRight"]);
const STORAGE_KEY = "bishoujo-n-keybindings-v1";
const STICK_DEADZONE = 0.16;

function cloneBindings(bindings: BindingMap): BindingMap {
  return Object.fromEntries(
    BINDABLE_ACTIONS.map((action) => [action, [...bindings[action]] as BindingSlots]),
  ) as BindingMap;
}

function isBindingCode(value: unknown): value is string {
  return typeof value === "string" && /^(?:Key[A-Z]|Digit[0-9]|Arrow(?:Left|Right|Up|Down)|Mouse[0-4]|Space|(?:Shift|Control|Alt)(?:Left|Right)|Backquote|Minus|Equal|BracketLeft|BracketRight|Backslash|Semicolon|Quote|Comma|Period|Slash|Numpad[0-9]|NumpadAdd|NumpadSubtract|NumpadMultiply|NumpadDivide)$/.test(value);
}

function loadBindings(): BindingMap {
  try {
    const stored = getStoredValue(STORAGE_KEY, "");
    if (!stored) return cloneBindings(DEFAULT_BINDINGS);
    const parsed = JSON.parse(stored) as Partial<Record<BindableAction, unknown>>;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return cloneBindings(DEFAULT_BINDINGS);

    const loaded = {} as BindingMap;
    const used = new Set<string>();

    for (const action of BINDABLE_ACTIONS) {
      const slots = parsed[action];
      if (!Array.isArray(slots) || slots.length !== 2) return cloneBindings(DEFAULT_BINDINGS);
      const validated = slots.map((code) => {
        if (code === null) return null;
        if (!isBindingCode(code) || RESERVED_BINDINGS.has(code) || used.has(code)) {
          throw new Error("Invalid key binding");
        }
        used.add(code);
        return code;
      }) as BindingSlots;
      if (!validated.some(Boolean)) return cloneBindings(DEFAULT_BINDINGS);
      loaded[action] = validated;
    }

    return loaded;
  } catch {
    return cloneBindings(DEFAULT_BINDINGS);
  }
}

export function bindingLabel(code: string | null): string {
  if (!code) return "未設定";
  const named: Record<string, string> = {
    Space: "Space",
    ArrowLeft: "←",
    ArrowRight: "→",
    ArrowUp: "↑",
    ArrowDown: "↓",
    Mouse0: "左クリック",
    Mouse1: "中クリック",
    Mouse2: "右クリック",
    Mouse3: "マウス戻る",
    Mouse4: "マウス進む",
    ShiftLeft: "左Shift",
    ShiftRight: "右Shift",
    ControlLeft: "左Ctrl",
    ControlRight: "右Ctrl",
    AltLeft: "左Alt",
    AltRight: "右Alt",
    Backquote: "`",
    Minus: "-",
    Equal: "=",
    BracketLeft: "[",
    BracketRight: "]",
    Backslash: "\\",
    Semicolon: ";",
    Quote: "'",
    Comma: ",",
    Period: ".",
    Slash: "/",
    NumpadAdd: "テンキー +",
    NumpadSubtract: "テンキー -",
    NumpadMultiply: "テンキー ×",
    NumpadDivide: "テンキー ÷",
  };
  if (named[code]) return named[code];
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  if (code.startsWith("Numpad")) return `テンキー ${code.slice(6)}`;
  return code;
}

function normalizeAxis(value: number, deadzone = STICK_DEADZONE): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - deadzone) / (1 - deadzone));
}

export class Input {
  private keyboardHeld = new Set<Action>();
  private mouseHeld = new Set<Action>();
  private touchHeld = new Set<Action>();
  private pressed = new Set<Action>();
  private gamepadHeld = new Set<Action>();
  private gamepadSuppressed = new Set<Action>();
  private bindings = loadBindings();
  private suspended = false;
  private touchElements: HTMLElement[] = [];
  private activeTouchPointers = new Map<number, { action: Action; element: HTMLElement }>();
  private activeMouseButtons = new Map<number, Action>();
  private touchCleanup: Array<() => void> = [];
  private moveStick: HTMLElement | null = null;
  private moveStickPointer: number | null = null;
  private touchMoveX = 0;
  private stickDown = false;
  private gamepadMoveX = 0;
  private onKeyDownBound = (event: KeyboardEvent) => this.onKeyDown(event);
  private onKeyUpBound = (event: KeyboardEvent) => this.onKeyUp(event);
  private onCanvasPointerDownBound = (event: PointerEvent) => this.onCanvasPointerDown(event);
  private onCanvasAuxClickBound = (event: MouseEvent) => this.onCanvasAuxClick(event);
  private onBlurBound = () => this.reset();
  private onPageHideBound = () => this.reset();
  private onGlobalPointerEndBound = (event: PointerEvent) => this.releasePointer(event);

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener("keydown", this.onKeyDownBound, { passive: false });
    window.addEventListener("keyup", this.onKeyUpBound, { passive: false });
    window.addEventListener("blur", this.onBlurBound);
    window.addEventListener("pagehide", this.onPageHideBound);
    window.addEventListener("pointerup", this.onGlobalPointerEndBound, true);
    window.addEventListener("pointercancel", this.onGlobalPointerEndBound, true);
    canvas.addEventListener("pointerdown", this.onCanvasPointerDownBound, { passive: false });
    canvas.addEventListener("auxclick", this.onCanvasAuxClickBound);
    this.bindTouchControls();
    this.bindMoveStick();
  }

  getBindings(): BindingMap {
    return cloneBindings(this.bindings);
  }

  setBinding(action: BindableAction, slot: number, code: string): BindingChangeResult {
    if (!BINDABLE_ACTIONS.includes(action) || (slot !== 0 && slot !== 1) || !isBindingCode(code)) {
      return { ok: false, message: "この入力は割り当てられません" };
    }
    if (RESERVED_BINDINGS.has(code)) {
      return { ok: false, message: "このキーは画面操作用に予約されています" };
    }

    const next = cloneBindings(this.bindings);
    const currentCode = next[action][slot];
    let swappedAction: BindableAction | undefined;

    for (const otherAction of BINDABLE_ACTIONS) {
      for (let otherSlot = 0; otherSlot < 2; otherSlot += 1) {
        if (otherAction === action && otherSlot === slot) continue;
        if (next[otherAction][otherSlot] !== code) continue;
        if (!currentCode && !next[otherAction][otherSlot === 0 ? 1 : 0]) {
          return { ok: false, message: `${ACTION_LABELS[otherAction]}の唯一の入力は移動できません` };
        }
        next[otherAction][otherSlot] = currentCode;
        swappedAction = otherAction;
      }
    }

    next[action][slot] = code;
    this.bindings = next;
    this.persistBindings();
    this.reset();
    return { ok: true, swappedAction };
  }

  clearBinding(action: BindableAction, slot: number): BindingChangeResult {
    if (!BINDABLE_ACTIONS.includes(action) || (slot !== 0 && slot !== 1)) {
      return { ok: false, message: "この割り当ては変更できません" };
    }
    const otherSlot = slot === 0 ? 1 : 0;
    if (!this.bindings[action][otherSlot]) {
      return { ok: false, message: "各操作には最低1つの入力が必要です" };
    }
    this.bindings[action][slot] = null;
    this.persistBindings();
    this.reset();
    return { ok: true };
  }

  resetBindings(): void {
    this.bindings = cloneBindings(DEFAULT_BINDINGS);
    this.persistBindings();
    this.reset();
  }

  setSuspended(suspended: boolean): void {
    if (this.suspended === suspended) return;
    this.suspended = suspended;
    this.reset();
  }

  down(action: Action): boolean {
    if (this.suspended) return false;
    if (action === "left" && (this.touchMoveX < -STICK_DEADZONE || this.gamepadMoveX < -STICK_DEADZONE)) return true;
    if (action === "right" && (this.touchMoveX > STICK_DEADZONE || this.gamepadMoveX > STICK_DEADZONE)) return true;
    if (action === "down" && this.stickDown) return true;
    return this.keyboardHeld.has(action) || this.mouseHeld.has(action) || this.touchHeld.has(action) || this.gamepadHeld.has(action);
  }

  horizontal(): number {
    if (this.suspended) return 0;
    const digital =
      (this.keyboardHeld.has("right") || this.mouseHeld.has("right") || this.touchHeld.has("right") || this.gamepadHeld.has("right") ? 1 : 0)
      - (this.keyboardHeld.has("left") || this.mouseHeld.has("left") || this.touchHeld.has("left") || this.gamepadHeld.has("left") ? 1 : 0);
    if (digital !== 0) return digital;
    return Math.abs(this.touchMoveX) >= Math.abs(this.gamepadMoveX) ? this.touchMoveX : this.gamepadMoveX;
  }

  consume(action: Action): boolean {
    if (this.suspended || !this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  press(action: Action): void {
    if (this.suspended) return;
    if (!this.down(action)) this.pressed.add(action);
    this.touchHeld.add(action);
  }

  release(action: Action): void {
    this.touchHeld.delete(action);
  }

  pollGamepad(): void {
    if (this.suspended) {
      this.gamepadHeld.clear();
      this.gamepadMoveX = 0;
      return;
    }
    const pad = this.connectedGamepad();
    if (!pad) {
      this.gamepadHeld.clear();
      this.gamepadSuppressed.clear();
      this.gamepadMoveX = 0;
      return;
    }

    this.gamepadMoveX = normalizeAxis(pad.axes[0] ?? 0);
    const next = this.readGamepadActions(pad);
    this.gamepadSuppressed.forEach((action) => {
      if (!next.has(action)) this.gamepadSuppressed.delete(action);
    });

    next.forEach((action) => {
      if (this.gamepadSuppressed.has(action)) return;
      if (!this.gamepadHeld.has(action) && !this.keyboardHeld.has(action) && !this.mouseHeld.has(action) && !this.touchHeld.has(action)) {
        this.pressed.add(action);
      }
    });
    this.gamepadHeld = next;
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  reset(): void {
    const pad = this.connectedGamepad();
    if (pad) {
      this.readGamepadActions(pad).forEach((action) => this.gamepadSuppressed.add(action));
    } else {
      this.gamepadSuppressed.clear();
    }
    this.keyboardHeld.clear();
    this.mouseHeld.clear();
    this.touchHeld.clear();
    this.pressed.clear();
    this.gamepadHeld.clear();
    this.activeMouseButtons.clear();
    this.gamepadMoveX = 0;
    this.touchMoveX = 0;
    this.stickDown = false;

    this.activeTouchPointers.forEach(({ element }, pointerId) => {
      try {
        if (element.hasPointerCapture?.(pointerId)) element.releasePointerCapture(pointerId);
      } catch {
        // Pointer capture can already be gone after an app switch.
      }
    });
    this.activeTouchPointers.clear();
    this.touchElements.forEach((element) => element.classList.remove("is-pressed"));
    this.resetMoveStick();
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDownBound);
    window.removeEventListener("keyup", this.onKeyUpBound);
    window.removeEventListener("blur", this.onBlurBound);
    window.removeEventListener("pagehide", this.onPageHideBound);
    window.removeEventListener("pointerup", this.onGlobalPointerEndBound, true);
    window.removeEventListener("pointercancel", this.onGlobalPointerEndBound, true);
    this.canvas.removeEventListener("pointerdown", this.onCanvasPointerDownBound);
    this.canvas.removeEventListener("auxclick", this.onCanvasAuxClickBound);
    this.touchCleanup.forEach((cleanup) => cleanup());
    this.touchCleanup = [];
    this.reset();
  }

  private persistBindings(): void {
    setStoredValue(STORAGE_KEY, JSON.stringify(this.bindings));
  }

  private actionForCode(code: string): Action | undefined {
    const fixed = FIXED_KEY_BINDINGS[code];
    if (fixed) return fixed;
    return BINDABLE_ACTIONS.find((action) => this.bindings[action].includes(code));
  }

  private onKeyDown(event: KeyboardEvent): void {
    if (this.suspended) return;
    const action = this.actionForCode(event.code);
    if (!action) return;
    event.preventDefault();
    if (!event.repeat && !this.down(action)) this.pressed.add(action);
    this.keyboardHeld.add(action);
  }

  private onKeyUp(event: KeyboardEvent): void {
    const action = this.actionForCode(event.code);
    if (!action) return;
    this.keyboardHeld.delete(action);
  }

  private onCanvasPointerDown(event: PointerEvent): void {
    if (this.suspended || event.pointerType !== "mouse") return;
    const action = this.actionForCode(`Mouse${event.button}`);
    if (!action || action === "pause" || action === "confirm") return;
    event.preventDefault();
    if (!this.down(action)) this.pressed.add(action);
    this.mouseHeld.add(action);
    this.activeMouseButtons.set(event.button, action);
    this.canvas.focus({ preventScroll: true });
  }

  private onCanvasAuxClick(event: MouseEvent): void {
    const action = this.actionForCode(`Mouse${event.button}`);
    if (action) event.preventDefault();
  }

  private connectedGamepad(): Gamepad | undefined {
    return Array.from(navigator.getGamepads?.() ?? []).find((candidate): candidate is Gamepad => Boolean(candidate?.connected));
  }

  private readGamepadActions(pad: Gamepad): Set<Action> {
    const actions = new Set<Action>();
    if (pad.buttons[14]?.pressed) actions.add("left");
    if (pad.buttons[15]?.pressed) actions.add("right");
    if ((pad.axes[1] ?? 0) > 0.48 || pad.buttons[13]?.pressed) actions.add("down");
    if (pad.buttons[0]?.pressed) {
      actions.add("jump");
      actions.add("confirm");
    }
    if (pad.buttons[2]?.pressed) actions.add("attack");
    if (pad.buttons[3]?.pressed) actions.add("charm");
    if (pad.buttons[1]?.pressed || pad.buttons[5]?.pressed) actions.add("dash");
    if (pad.buttons[4]?.pressed || (pad.buttons[6]?.pressed && pad.buttons[7]?.pressed)) actions.add("ultimate");
    if (pad.buttons[9]?.pressed) actions.add("pause");
    return actions;
  }

  private releaseTouchPointer(pointerId: number): void {
    const active = this.activeTouchPointers.get(pointerId);
    if (!active) return;
    this.activeTouchPointers.delete(pointerId);

    const elementStillPressed = [...this.activeTouchPointers.values()].some((pointer) => pointer.element === active.element);
    if (!elementStillPressed) active.element.classList.remove("is-pressed");

    const actionStillPressed = [...this.activeTouchPointers.values()].some((pointer) => pointer.action === active.action);
    if (!actionStillPressed) this.release(active.action);

    try {
      if (active.element.hasPointerCapture?.(pointerId)) active.element.releasePointerCapture(pointerId);
    } catch {
      // Capture may already have been released by the browser.
    }
  }

  private releasePointer(event: PointerEvent): void {
    this.releaseTouchPointer(event.pointerId);
    if (this.moveStickPointer === event.pointerId) this.resetMoveStick();
    if (event.pointerType === "mouse") {
      const action = this.activeMouseButtons.get(event.button);
      if (action) this.mouseHeld.delete(action);
      this.activeMouseButtons.delete(event.button);
    }
  }

  private resetMoveStick(): void {
    const pointerId = this.moveStickPointer;
    if (this.moveStick && pointerId !== null) {
      try {
        if (this.moveStick.hasPointerCapture?.(pointerId)) this.moveStick.releasePointerCapture(pointerId);
      } catch {
        // Capture may already have been released by the browser.
      }
    }
    this.moveStickPointer = null;
    this.touchMoveX = 0;
    this.stickDown = false;
    this.moveStick?.classList.remove("is-active");
    this.moveStick?.style.setProperty("--stick-x", "0px");
    this.moveStick?.style.setProperty("--stick-y", "0px");
  }

  private bindTouchControls(): void {
    document.querySelectorAll<HTMLElement>("[data-control]").forEach((element) => {
      const action = element.dataset.control as Action | undefined;
      if (!action) return;
      this.touchElements.push(element);

      const begin = (event: PointerEvent) => {
        event.preventDefault();
        if (this.suspended || this.activeTouchPointers.has(event.pointerId)) return;
        try {
          element.setPointerCapture?.(event.pointerId);
        } catch {
          // Some mobile browsers can reject capture while the page is changing state.
        }
        this.activeTouchPointers.set(event.pointerId, { action, element });
        element.classList.add("is-pressed");
        this.press(action);
      };
      const end = (event: PointerEvent) => {
        if (event.cancelable) event.preventDefault();
        this.releaseTouchPointer(event.pointerId);
      };
      const leave = (event: PointerEvent) => {
        if (event.buttons === 0) this.releaseTouchPointer(event.pointerId);
      };
      const preventDefault = (event: Event) => event.preventDefault();

      element.addEventListener("pointerdown", begin);
      element.addEventListener("pointerup", end);
      element.addEventListener("pointercancel", end);
      element.addEventListener("lostpointercapture", end);
      element.addEventListener("pointerleave", leave);
      element.addEventListener("contextmenu", preventDefault);
      element.addEventListener("selectstart", preventDefault);
      element.addEventListener("dragstart", preventDefault);

      this.touchCleanup.push(() => {
        element.removeEventListener("pointerdown", begin);
        element.removeEventListener("pointerup", end);
        element.removeEventListener("pointercancel", end);
        element.removeEventListener("lostpointercapture", end);
        element.removeEventListener("pointerleave", leave);
        element.removeEventListener("contextmenu", preventDefault);
        element.removeEventListener("selectstart", preventDefault);
        element.removeEventListener("dragstart", preventDefault);
      });
    });
  }

  private bindMoveStick(): void {
    const stick = document.querySelector<HTMLElement>('[data-stick="move"]');
    if (!stick) return;
    this.moveStick = stick;

    const update = (event: PointerEvent) => {
      const rect = stick.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const maxRadius = Math.max(1, Math.min(rect.width, rect.height) * 0.31);
      let dx = event.clientX - centerX;
      let dy = event.clientY - centerY;
      const distance = Math.hypot(dx, dy);
      if (distance > maxRadius) {
        dx = (dx / distance) * maxRadius;
        dy = (dy / distance) * maxRadius;
      }
      const normalizedX = dx / maxRadius;
      const normalizedY = dy / maxRadius;
      this.touchMoveX = normalizeAxis(normalizedX);
      this.stickDown = normalizedY > 0.42;
      stick.style.setProperty("--stick-x", `${dx.toFixed(1)}px`);
      stick.style.setProperty("--stick-y", `${dy.toFixed(1)}px`);
    };

    const begin = (event: PointerEvent) => {
      event.preventDefault();
      if (this.suspended || this.moveStickPointer !== null) return;
      this.moveStickPointer = event.pointerId;
      stick.classList.add("is-active");
      try {
        stick.setPointerCapture?.(event.pointerId);
      } catch {
        // Pointer capture is an enhancement; the global release handler remains the fallback.
      }
      update(event);
    };
    const move = (event: PointerEvent) => {
      if (event.pointerId !== this.moveStickPointer) return;
      event.preventDefault();
      update(event);
    };
    const end = (event: PointerEvent) => {
      if (event.pointerId !== this.moveStickPointer) return;
      if (event.cancelable) event.preventDefault();
      this.resetMoveStick();
    };
    const preventDefault = (event: Event) => event.preventDefault();

    stick.addEventListener("pointerdown", begin);
    stick.addEventListener("pointermove", move);
    stick.addEventListener("pointerup", end);
    stick.addEventListener("pointercancel", end);
    stick.addEventListener("lostpointercapture", end);
    stick.addEventListener("contextmenu", preventDefault);
    stick.addEventListener("selectstart", preventDefault);
    stick.addEventListener("dragstart", preventDefault);

    this.touchCleanup.push(() => {
      stick.removeEventListener("pointerdown", begin);
      stick.removeEventListener("pointermove", move);
      stick.removeEventListener("pointerup", end);
      stick.removeEventListener("pointercancel", end);
      stick.removeEventListener("lostpointercapture", end);
      stick.removeEventListener("contextmenu", preventDefault);
      stick.removeEventListener("selectstart", preventDefault);
      stick.removeEventListener("dragstart", preventDefault);
    });
  }
}
