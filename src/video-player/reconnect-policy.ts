/** Delays before reconnect attempts 1 to 5, in milliseconds. */
const SCHEDULE = [0, 2000, 5000, 10000, 10000];

/** Counts the displayed reconnect attempt on the 0, 2, 5, 10, 10 s schedule. */
export class ReconnectPolicy {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private attempt = 0;

  /** Reports attempt 1 at once and each later attempt after its delay, up to attempt 5. */
  start(onAttempt: (attempt: number) => void): void {
    this.reset();
    this.next(onAttempt);
  }

  /** Cancels any pending attempt and returns the counter to 0. */
  reset(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.attempt = 0;
  }

  private next(onAttempt: (attempt: number) => void): void {
    this.attempt++;
    onAttempt(this.attempt);
    if (this.attempt < SCHEDULE.length)
      this.timer = setTimeout(() => this.next(onAttempt), SCHEDULE[this.attempt]);
  }
}
