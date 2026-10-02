import { PersistenceCoordinator } from './persistence-coordinator';
import {
  AttemptContext,
  AttemptSnapshot,
  HostIntegration,
  SaveAck,
  SaveSubmission,
} from '../types';

const context: AttemptContext = { attemptKey: 'a', courseKey: 'c', courseRevision: '1' };
const snapshot = (location: string): AttemptSnapshot => ({
  schemaVersion: 1,
  context,
  edition: '1.2',
  scoStates: { s: { values: { 'cmi.core.lesson_location': location } } },
  sequencing: { currentActivityId: 's' },
});

function setup() {
  const sent: { revision: number; location: string; settle: (ack: SaveAck | Error) => void }[] = [];
  const host = {
    saveState: (_context: AttemptContext, submission: SaveSubmission) =>
      new Promise<SaveAck>((resolve, reject) =>
        sent.push({
          revision: submission.revision,
          location: submission.snapshot.scoStates['s'].values['cmi.core.lesson_location'],
          settle: (result) => (result instanceof Error ? reject(result) : resolve(result)),
        }),
      ),
  } as unknown as HostIntegration;
  const acknowledged: [number, boolean][] = [];
  let failures = 0;
  const coordinator = new PersistenceCoordinator(host, context, {
    onAcknowledged: (revision, upToDate) => acknowledged.push([revision, upToDate]),
    onFailed: () => failures++,
  });
  return { coordinator, sent, acknowledged, failures: () => failures };
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('PersistenceCoordinator', () => {
  it('keeps at most one save in flight and sends the newest snapshot next', async () => {
    const { coordinator, sent, acknowledged } = setup();

    coordinator.submit(snapshot('1'));
    coordinator.submit(snapshot('2'));
    coordinator.submit(snapshot('3'));
    expect(sent.map((s) => s.location)).toEqual(['1']);

    sent[0].settle({ revision: 1 });
    await flush();
    expect(sent.map((s) => s.location)).toEqual(['1', '3']);
    expect(acknowledged).toEqual([[1, false]]);

    sent[1].settle({ revision: 3 });
    await flush();
    expect(acknowledged).toEqual([
      [1, false],
      [3, true],
    ]);
  });

  it('retains the newest snapshot after a failure and retries it on request', async () => {
    const { coordinator, sent, failures } = setup();

    coordinator.submit(snapshot('1'));
    coordinator.submit(snapshot('2'));
    sent[0].settle(new Error('down'));
    await flush();
    expect(failures()).toBe(1);
    expect(sent).toHaveLength(1);

    coordinator.retry();
    expect(sent.map((s) => [s.revision, s.location])).toEqual([
      [1, '1'],
      [2, '2'],
    ]);
  });

  it('treats an acknowledgement of a different revision as a failure', async () => {
    const { coordinator, sent, acknowledged, failures } = setup();

    coordinator.submit(snapshot('1'));
    sent[0].settle({ revision: 0 });
    await flush();

    expect(acknowledged).toEqual([]);
    expect(failures()).toBe(1);
  });

  it('reports each acknowledged revision only once', async () => {
    const { coordinator, sent, acknowledged } = setup();

    coordinator.submit(snapshot('1'));
    sent[0].settle({ revision: 1 });
    await flush();
    coordinator.retry();
    sent[1].settle({ revision: 1 });
    await flush();

    expect(acknowledged).toEqual([[1, true]]);
  });
});
