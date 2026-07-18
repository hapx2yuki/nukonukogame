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
  private held = new Set<Action>();
  private pressed = new Set<Action>();
  private gamepadHeld = new Set<Action>();
  private touchElements: HTMLElement[] = [];
  private onKeyDownBound = (event: KeyboardEvent) => this.onKeyDown(event);
  private onKeyUpBound = (event: KeyboardEvent) => this.onKeyUp(event);
  private onBlurBound = () => this.reset();

  constructor() {
    window.addEventListener("keydown", this.onKeyDownBound, { passive: false });
    window.addEventListener("keyup", this.onKeyUpBound, { passive: false });
    window.addEventListener("blur", this.onBlurBound);
    this.bindTouchControls();
  }

  down(action: Action): boolean {
    return this.held.has(action) || this.gamepadHeld.has(action);
  }

  consume(action: Action): boolean {
    if (!this.pressed.has(action)) return false;
    this.pressed.delete(action);
    return true;
  }

  press(action: Action): void {
    if (!this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }

  release(action: Action): void {
    this.held.delete(action);
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
      if (!this.gamepadHeld.has(action) && !this.held.has(action)) this.pressed.add(action);
    });
    this.gamepadHeld = next;
  }

  clearPressed(): void {
    this.pressed.clear();
  }

  reset(): void {
    this.held.clear();
    this.pressed.clear();
    this.gamepadHeld.clear();
    this.touchElements.forEach((element) => element.classList.remove("is-pressed"));
  }

  destroy(): void {
    window.removeEventListener("keydown", this.onKeyDownBound);
    window.removeEventListener("keyup", this.onKeyUpBound);
    window.removeEventListener("blur", this.onBlurBound);
  }

  private onKeyDown(event: KeyboardEvent): void {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    if (["ArrowLeft", "ArrowRight", "ArrowDown", "Space"].includes(event.code)) event.preventDefault();
    if (!event.repeat && !this.held.has(action)) this.pressed.add(action);
    this.held.add(action);
  }

  private onKeyUp(event: KeyboardEvent): void {
    const action = KEY_BINDINGS[event.code];
    if (!action) return;
    this.held.delete(action);
  }

  private bindTouchControls(): void {
    document.querySelectorAll<HTMLElement>("[data-control]").forEach((element) => {
      const action = element.dataset.control as Action | undefined;
      if (!action) return;
      this.touchElements.push(element);

      const begin = (event: PointerEvent) => {
        event.preventDefault();
        element.setPointerCapture?.(event.pointerId);
        element.classList.add("is-pressed");
        this.press(action);
      };
      const end = (event: PointerEvent) => {
        event.preventDefault();
        element.classList.remove("is-pressed");
        this.release(action);
      };

      element.addEventListener("pointerdown", begin);
      element.addEventListener("pointerup", end);
      element.addEventListener("pointercancel", end);
      element.addEventListener("pointerleave", (event) => {
        if (event.buttons === 0) end(event);
      });
      element.addEventListener("contextmenu", (event) => event.preventDefault());
    });
  }
}
