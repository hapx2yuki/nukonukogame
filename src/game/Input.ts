export type Action = "left" | "right" | "down" | "jump" | "attack" | "charm" | "dash" | "ultimate" | "pause" | "confirm";

const KEY_BINDINGS: Record<string, Action> = {
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
  ArrowDown: "down",
  KeyS: "down",
  Space: "jump",
  KeyJ: "attack",
  KeyZ: "attack",
  KeyK: "charm",
  KeyX: "charm",
  KeyL: "dash",
  KeyC: "dash",
  KeyE: "ultimate",
  KeyV: "ultimate",
  Escape: "pause",
  Enter: "confirm",
};

const STICK_DEADZONE = 0.16;

function normalizeAxis(value: number, deadzone = STICK_DEADZONE): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - deadzone) / (1 - deadzone));
}

export class Input {
  private keyboardHeld = new Set<Action>();
  private touchHeld = new Set<Action>();
  private pressed = new Set<Action>();
  private gamepadHeld = new Set<Action>();
  private gamepadSuppressed = new Set<Action>();
  private touchElements: HTMLElement[] = [];
  private activeTouchPointers = new Map<number, { action: Action; element: HTMLElement }>();
  private touchCleanup: Array<() => void> = [];
  private moveStick: HTMLElement | null = null;
  private moveStickPointer: number | null = null;
  private touchMoveX = 0;
  private stickDown = false;
  private gamepadMoveX = 0;
  private onKeyDownBound = (event: KeyboardEvent) => this.onKeyDown(event);
  private onKeyUpBound = (event: KeyboardEvent) => this.onKeyUp(event);
  private onBlurBound = () => this.reset();
  private onPageHideBound = () => this.reset();
  private onGlobalPointerEndBound = (event: PointerEvent) => this.releasePointer(event.pointerId);

  constructor() {
    window.addEventListener("keydown", this.onKeyDownBound, { passive: false });
    window.addEventListener("keyup", this.onKeyUpBound, { passive: false });
    window.addEventListener("blur", this.onBlurBound);
    window.addEventListener("pagehide", this.onPageHideBound);
    window.addEventListener("pointerup", this.onGlobalPointerEndBound, true);
    window.addEventListener("pointercancel", this.onGlobalPointerEndBound, true);
    this.bindTouchControls();
    this.bindMoveStick();
  }

  down(action: Action): boolean {
    if (action === "left" && (this.touchMoveX < -STICK_DEADZONE || this.gamepadMoveX < -STICK_DEADZONE)) return true;
    if (action === "right" && (this.touchMoveX > STICK_DEADZONE || this.gamepadMoveX > STICK_DEADZONE)) return true;
    if (action === "down" && this.stickDown) return true;
    return this.keyboardHeld.has(action) || this.touchHeld.has(action) || this.gamepadHeld.has(action);
  }

  horizontal(): number {
    const digital =
      (this.keyboardHeld.has("right") || this.touchHeld.has("right") || this.gamepadHeld.has("right") ? 1 : 0)
      - (this.keyboardHeld.has("left") || this.touchHeld.has("left") || this.gamepadHeld.has("left") ? 1 : 0);
    if (digital !== 0) return digital;
    return Math.abs(this.touchMoveX) >= Math.abs(this.gamepadMoveX) ? this.touchMoveX : this.gamepadMoveX;
  }

  consume(action: Action): boolean {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  press(action: Action): void {
    if (!this.down(action)) this.pressed.add(action);
    this.touchHeld.add(action);
  }

  release(action: Action): void {
    this.touchHeld.delete(action);
  }

  pollGamepad(): void {
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
      if (!this.gamepadHeld.has(action) && !this.keyboardHeld.has(action) && !this.touchHeld.has(action)) {
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
    this.touchHeld.clear();
    this.pressed.clear();
    this.gamepadHeld.clear();
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
    this.touchCleanup.forEach((cleanup) => cleanup());
    this.touchCleanup = [];
    this.reset();
  }

  private onKeyDown(event: KeyboardEvent): void {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
    if (!event.repeat && !this.down(action)) this.pressed.add(action);
    this.keyboardHeld.add(action);
  }

  private onKeyUp(event: KeyboardEvent): void {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    this.keyboardHeld.delete(action);
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

  private releasePointer(pointerId: number): void {
    this.releaseTouchPointer(pointerId);
    if (this.moveStickPointer === pointerId) this.resetMoveStick();
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
        if (this.activeTouchPointers.has(event.pointerId)) return;
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
      if (this.moveStickPointer !== null) return;
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
