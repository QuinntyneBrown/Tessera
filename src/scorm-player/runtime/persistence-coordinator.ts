import { AttemptContext, AttemptSnapshot, HostIntegration } from '../types';

/** Sends attempt snapshots to the host and reports the revisions it acknowledges. */
export class PersistenceCoordinator {
  private revision = 0;

  constructor(
    private readonly host: HostIntegration,
    private readonly context: AttemptContext,
    private readonly onAcknowledged: (revision: number) => void,
  ) {}

  submit(snapshot: AttemptSnapshot): void {
    const submission = { snapshot, revision: ++this.revision };
    this.host.saveState(this.context, submission, new AbortController().signal).then((ack) => {
      if (ack.revision === submission.revision) this.onAcknowledged(ack.revision);
    });
  }
}
