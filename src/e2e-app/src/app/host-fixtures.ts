import { signal } from '@angular/core';
import {
  AttemptContext,
  AttemptSnapshot,
  SaveAck,
  CourseSource,
  HostIntegration,
  SaveSubmission,
} from '@tessera/scorm-player';

/** Holds each save until the test acknowledges or fails it, so tests control save timing. */
export class SaveGate {
  readonly pending = signal(0);
  private waiting: {
    submission: SaveSubmission;
    resolve: (ack: SaveAck) => void;
    reject: (error: Error) => void;
  }[] = [];

  hold(submission: SaveSubmission): Promise<SaveAck> {
    return new Promise((resolve, reject) => {
      this.waiting.push({ submission, resolve, reject });
      this.pending.set(this.waiting.length);
    });
  }

  acknowledge(): void {
    const next = this.waiting.shift();
    this.pending.set(this.waiting.length);
    next?.resolve({ revision: next.submission.revision });
  }

  /** Acknowledges the pending save with a revision older than the one submitted. */
  acknowledgeStale(): void {
    const next = this.waiting.shift();
    this.pending.set(this.waiting.length);
    next?.resolve({ revision: next.submission.revision - 1 });
  }

  fail(): void {
    const next = this.waiting.shift();
    this.pending.set(this.waiting.length);
    next?.reject(new Error('host unavailable'));
  }
}

export interface HostFixture {
  source: CourseSource;
  attempt?: AttemptContext;
  host?: HostIntegration;
}

const COURSE_ORIGIN = 'http://127.0.0.1:4300';

/** The state the host has stored for an attempt: a distinct location per attempt key. */
function savedSnapshot(context: AttemptContext, foreign: boolean): AttemptSnapshot {
  return {
    schemaVersion: 1,
    context: foreign ? { ...context, attemptKey: 'someone-elses-attempt' } : context,
    edition: '1.2',
    scoStates: {
      item1: {
        values: {
          'cmi.core.lesson_location': `page 8 of ${context.attemptKey}`,
          'cmi.suspend_data': 'chapter=3;answers=ab',
          'cmi.core.exit': 'suspend',
        },
      },
    },
    sequencing: { currentActivityId: 'item1' },
  };
}

/** Builds the host-side inputs for the scenario named by the page's query string. */
export function hostFixtureFor(
  query: URLSearchParams,
  onSave: (submission: SaveSubmission) => void,
  gate: SaveGate,
): HostFixture {
  const omit = query.get('omit');
  const courseName = query.get('course') ?? 'single-sco-12';
  return {
    source: {
      kind: 'manifest',
      manifestUrl: `${COURSE_ORIGIN}/courses/${courseName}/imsmanifest.xml`,
    },
    attempt:
      omit === 'attempt'
        ? undefined
        : {
            attemptKey: query.get('attempt') ?? 'attempt-1',
            courseKey: 'course-1',
            courseRevision: '1',
          },
    host:
      omit === 'host'
        ? undefined
        : {
            loadAttempt: async (context) => {
              const snapshot = query.get('snapshot');
              if (snapshot === 'unreadable') throw new Error('storage unavailable');
              return snapshot ? savedSnapshot(context, snapshot === 'foreign') : null;
            },
            saveState: async (_context, submission) => {
              onSave(submission);
              if (query.get('save') === 'manual') return gate.hold(submission);
              return { revision: submission.revision };
            },
            prepareDelivery: async () => {
              if (query.get('isolation') === 'unavailable') throw new Error('no isolated origin');
              return {
                courseRoot: `${COURSE_ORIGIN}/courses/${courseName}/`,
                wrapperUrl: `${query.get('isolation') === 'none' ? location.origin : COURSE_ORIGIN}/wrapper/wrapper.html`,
                bridgeProtocolVersion: 1,
              };
            },
          },
  };
}
