/** Writes the instance-owned polite live region; status messages coalesce within 150 ms. */
export class VideoPlayerAnnouncer {
  private pending: string | null = null;
  private timer: ReturnType<typeof setTimeout> | undefined;

  constructor(private readonly region: () => HTMLElement | undefined) {}

  status(message: string): void {
    this.pending = message;
    this.timer ??= setTimeout(() => {
      this.timer = undefined;
      this.write(this.pending);
      this.pending = null;
    }, 150);
  }

  /** Writes a control toggle message at once; it never drops a pending status. */
  toggle(message: string): void {
    this.write(message);
  }

  clear(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.pending = null;
    this.write('');
  }

  destroy(): void {
    clearTimeout(this.timer);
  }

  private write(message: string | null): void {
    const region = this.region();
    if (region && message !== null) region.textContent = message;
  }
}
