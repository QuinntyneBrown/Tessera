import { signal } from '@angular/core';
import {
  AttemptContext,
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
        : { attemptKey: 'attempt-1', courseKey: 'course-1', courseRevision: '1' },
    host:
      omit === 'host'
        ? undefined
        : {
            loadAttempt: async () => null,
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
