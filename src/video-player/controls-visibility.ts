import { signal } from '@angular/core';

/** Hides the control bar 3000 ms after the last activity while live, and never otherwise. */
export class ControlsVisibility {
  readonly visible = signal(true);
  private timer: ReturnType<typeof setTimeout> | undefined;
  private live = false;
  private hovered = false;
  private focused = false;
  private narrow = false;

  /** Shows the controls and restarts the hide timer. */
  show(): void {
    this.visible.set(true);
    this.schedule();
  }

  setLive(live: boolean): void {
    if (live === this.live) return;
    this.live = live;
    this.show();
  }

  setHovered(hovered: boolean): void {
    this.hovered = hovered;
    this.show();
  }

  setFocused(focused: boolean): void {
    this.focused = focused;
    this.show();
  }

  setNarrow(narrow: boolean): void {
    if (narrow === this.narrow) return;
    this.narrow = narrow;
    this.show();
  }

  destroy(): void {
    clearTimeout(this.timer);
  }

  private schedule(): void {
    clearTimeout(this.timer);
    if (!this.live || this.hovered || this.focused || this.narrow) return;
    this.timer = setTimeout(() => this.visible.set(false), 3000);
  }
}
