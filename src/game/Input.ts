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

export class Input {
  private keyboardHeld = new Set<Action>();
  private touchHeld = new Set<Action>();
  private pressed = new Set<Action>();
  private gamepadHeld = new Set<Action>();
  private touchElements: HTMLElement[] = [];
  private activeTouchPointers = new Map<number, { action: Action; element: HTMLElement }>();
  private touchCleanup: Array<() => void> = [];
  private onKeyDownBound = (event: KeyboardEvent) => this.onKeyDown(event);
  private onKeyUpBound = (event: KeyboardEvent) => this.onKeyUp(event);
  private onBlurBound = () => this.reset();
  private onPageHideBound = () => this.reset();

  constructor() {
    window.addEventListener("keydown", this.onKeyDownBound, { passive: false });
    window.addEventListener("keyup", this.onKeyUpBound, { passive: false });
    window.addEventListener("blur", this.onBlurBound);
    window.addEventListener("pagehide", this.onPageHideBound);
    this.bindTouchControls();
  }

  down(action: Action): boolean {
    return this.keyboardHeld.has(action) || this.touchHeld.has(action) || this.gamepadHeld.has(action);
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
    const pad = navigator.getGamepads?.()[0];
    if (!pad) {
      this.gamepadHeld.clear();
      return;
    }

    const next = new Set<Action>();
    if ((pad.axes[0] ?? 0) < -0.32 || pad.buttons[14]?.pressed) next.add("left");
    if ((pad.axes[0] ?? 0) > 0.32 || pad.buttons[15]?.pressed) next.add("right");
    if ((pad.axes[1] ?? 0) > 0.48 || pad.buttons[13]?.pressed) next.add("down");
    if (pad.buttons[0]?.pressed) next.add("jump");
    if (pad.buttons[2]?.pressed) next.add("attack");
    if (pad.buttons[3]?.pressed) next.add("charm");
    if (pad.buttons[5]?.pressed) next.add("dash");
    if ((pad.buttons[6]?.pressed && pad.buttons[7]?.pressed) || pad.buttons[4]?.pressed) next.add("ultimate");
    if (pad.buttons[9]?.pressed) next.add("pause");
    if (pad.buttons[0]?.pressed) next.add("confirm");

    next.forEach((action) => {
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
    this.keyboardHeld.clear();
    this.touchHeld.clear();
    this.pressed.clear();
    this.gamepadHeld.clear();
    this.activeTouchPointers.clear();
    this.touchElements.forEach((element) => element.classList.remove("is-pressed"));
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDownBound);
    window.removeEventListener("keyup", this.onKeyUpBound);
    window.removeEventListener("blur", this.onBlurBound);
    window.removeEventListener("pagehide", this.onPageHideBound);
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
        const active = this.activeTouchPointers.get(event.pointerId);
        if (!active || active.element !== element) return;
        this.activeTouchPointers.delete(event.pointerId);

        const elementStillPressed = [...this.activeTouchPointers.values()].some((pointer) => pointer.element === element);
        if (!elementStillPressed) element.classList.remove("is-pressed");

        const actionStillPressed = [...this.activeTouchPointers.values()].some((pointer) => pointer.action === action);
        if (!actionStillPressed) this.release(action);
      };
      const leave = (event: PointerEvent) => {
        if (event.buttons === 0) end(event);
      };
      const preventContextMenu = (event: Event) => event.preventDefault();

      element.addEventListener("pointerdown", begin);
      element.addEventListener("pointerup", end);
      element.addEventListener("pointercancel", end);
      element.addEventListener("lostpointercapture", end);
      element.addEventListener("pointerleave", leave);
      element.addEventListener("contextmenu", preventContextMenu);

      this.touchCleanup.push(() => {
        element.removeEventListener("pointerdown", begin);
        element.removeEventListener("pointerup", end);
        element.removeEventListener("pointercancel", end);
        element.removeEventListener("lostpointercapture", end);
        element.removeEventListener("pointerleave", leave);
        element.removeEventListener("contextmenu", preventContextMenu);
      });
    });
  }
}
