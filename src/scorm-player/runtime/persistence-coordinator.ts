import { AttemptContext, AttemptSnapshot, HostIntegration, SaveSubmission } from '../types';

/**
 * Sends attempt snapshots to the host, one save at a time, and reports the revisions it acknowledges.
 * Newer snapshots wait behind the in-flight save; after a failure the newest one waits for `retry`.
 */
export class PersistenceCoordinator {
  private latest: SaveSubmission | null = null;
  private inFlight: SaveSubmission | null = null;
  private failed = false;
  private acknowledged = 0;
  private drainers: ((saved: boolean) => void)[] = [];

  constructor(
    private readonly host: HostIntegration,
    private readonly context: AttemptContext,
    private readonly events: {
      /** `upToDate` is false while a newer snapshot is still unsaved. */
      onAcknowledged: (revision: number, upToDate: boolean) => void;
      onFailed: () => void;
    },
  ) {}

  submit(snapshot: AttemptSnapshot): void {
    this.latest = { snapshot, revision: (this.latest?.revision ?? 0) + 1 };
    if (!this.inFlight && !this.failed) this.send();
  }

  /** Whether the newest snapshot has not yet been acknowledged. */
  get unsaved(): boolean {
    return !!this.latest && this.latest.revision > this.acknowledged;
  }

  /** Settles once everything is acknowledged (true) or a save has failed (false). */
  drain(): Promise<boolean> {
    if (!this.unsaved) return Promise.resolve(true);
    if (this.failed) return Promise.resolve(false);
    return new Promise((resolve) => this.drainers.push(resolve));
  }

  /** Submits the newest retained snapshot again. */
  retry(): void {
    if (this.inFlight || !this.latest) return;
    this.failed = false;
    this.send();
  }

  private send(): void {
    const submission = this.latest!;
    this.inFlight = submission;
    this.host.saveState(this.context, submission, new AbortController().signal).then(
      (ack) => this.settle(submission, ack.revision === submission.revision),
      () => this.settle(submission, false),
    );
  }

  private settle(submission: SaveSubmission, saved: boolean): void {
    this.inFlight = null;
    if (!saved) {
      this.failed = true;
      this.events.onFailed();
      this.releaseDrainers();
      return;
    }
    if (submission.revision > this.acknowledged) {
      this.acknowledged = submission.revision;
      this.events.onAcknowledged(
        submission.revision,
        submission.revision === this.latest!.revision,
      );
    }
    if (this.latest!.revision > this.acknowledged) this.send();
    this.releaseDrainers();
  }

  private releaseDrainers(): void {
    if (this.inFlight || (!this.failed && this.unsaved)) return;
    const saved = !this.unsaved;
    this.drainers.splice(0).forEach((resolve) => resolve(saved));
  }
}
