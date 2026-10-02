import { AttemptContext, AttemptSnapshot, HostIntegration, SaveSubmission } from '../types';

/** Sends attempt snapshots to the host and reports the revisions it acknowledges or fails to save. */
export class PersistenceCoordinator {
  private latest: SaveSubmission | null = null;

  constructor(
    private readonly host: HostIntegration,
    private readonly context: AttemptContext,
    private readonly events: { onAcknowledged: (revision: number) => void; onFailed: () => void },
  ) {}

  submit(snapshot: AttemptSnapshot): void {
    this.latest = { snapshot, revision: (this.latest?.revision ?? 0) + 1 };
    this.send();
  }

  /** Submits the latest retained snapshot again. */
  retry(): void {
    this.send();
  }

  private send(): void {
    const submission = this.latest!;
    this.host.saveState(this.context, submission, new AbortController().signal).then(
      (ack) => {
        if (ack.revision === submission.revision) this.events.onAcknowledged(ack.revision);
      },
      () => this.events.onFailed(),
    );
  }
}
