import { signal } from '@angular/core';
import {
  AttemptContext,
  AttemptSnapshot,
  PackageLimits,
  SaveAck,
  CourseSource,
  HostIntegration,
  SaveSubmission,
  ScormEdition,
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
  /** Undefined until the host has a course: for ZIP scenarios, until a package is chosen. */
  source?: CourseSource;
  attempt?: AttemptContext;
  host?: HostIntegration;
  limits?: PackageLimits;
}

const COURSE_ORIGIN =
  new URLSearchParams(location.search).get('courseOrigin') ?? 'http://127.0.0.1:4300';

/** The state the host has stored for an attempt: a distinct location per attempt key. */
function savedSnapshot(
  context: AttemptContext,
  foreign: boolean,
  edition: ScormEdition,
): AttemptSnapshot {
  const location = `page 8 of ${context.attemptKey}`;
  return {
    schemaVersion: 1,
    context: foreign ? { ...context, attemptKey: 'someone-elses-attempt' } : context,
    edition,
    scoStates: {
      item1: {
        values:
          edition === '1.2'
            ? {
                'cmi.core.lesson_location': location,
                'cmi.suspend_data': 'chapter=3;answers=ab',
                'cmi.core.exit': 'suspend',
              }
            : {
                'cmi.location': location,
                'cmi.suspend_data': 'chapter=3;answers=ab',
                'cmi.exit': 'suspend',
              },
      },
    },
    sequencing: { currentActivityId: 'item1' },
  };
}

/** For the single-attempt quiz course: the quiz has been taken and the learner moved on to the summary. */
function quizTakenSnapshot(context: AttemptContext): AttemptSnapshot {
  return {
    schemaVersion: 1,
    context,
    edition: '2004-3rd',
    scoStates: {},
    sequencing: {
      currentActivityId: 'summary',
      tracking: {
        activities: { org1: { attempts: 1 }, quiz: { attempts: 1 }, summary: { attempts: 1 } },
      },
    },
  };
}

/** Serves a ZIP package's validated files from the course origin, as an LMS would. */
async function uploadFiles(
  context: AttemptContext,
  files: ReadonlyMap<string, Blob>,
): Promise<void> {
  await Promise.all(
    Array.from(files, ([path, blob]) =>
      fetch(`${COURSE_ORIGIN}/delivery/${context.attemptKey}/${path}`, {
        method: 'PUT',
        body: blob,
      }),
    ),
  );
}

/** Builds the host-side inputs for the scenario named by the page's query string. */
export function hostFixtureFor(
  query: URLSearchParams,
  onSave: (context: AttemptContext, submission: SaveSubmission) => void,
  gate: SaveGate,
): HostFixture {
  const omit = query.get('omit');
  const limits = {
    'small-archive': { archiveBytes: 100, expandedBytes: 500_000_000, entryCount: 10_000 },
    'few-entries': { archiveBytes: 100_000_000, expandedBytes: 500_000_000, entryCount: 5 },
    'small-expanded': { archiveBytes: 100_000_000, expandedBytes: 1_000_000, entryCount: 10_000 },
  }[query.get('limits') ?? ''];
  let readsFailed = 0;
  const courseName = query.get('course') ?? 'single-sco-12';
  return {
    limits,
    source:
      query.get('source') === 'zip'
        ? undefined
        : {
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
              if (snapshot === 'unreadable' || (snapshot === 'flaky' && readsFailed++ === 0)) {
                throw new Error('storage unavailable');
              }
              const edition = /2004-(2nd|3rd|4th)/.exec(courseName)?.[0] as ScormEdition;
              if (snapshot === 'quiz-taken') return quizTakenSnapshot(context);
              return snapshot
                ? savedSnapshot(context, snapshot === 'foreign', edition ?? '1.2')
                : null;
            },
            saveState: async (context, submission) => {
              onSave(context, submission);
              if (query.get('save') === 'manual') return gate.hold(submission);
              return { revision: submission.revision };
            },
            prepareDelivery: async (context, course) => {
              if (query.get('isolation') === 'unavailable') throw new Error('no isolated origin');
              if (course.files) await uploadFiles(context, course.files);
              return {
                courseRoot: course.files
                  ? `${COURSE_ORIGIN}/delivery/${context.attemptKey}/`
                  : `${COURSE_ORIGIN}/courses/${courseName}/`,
                wrapperUrl: `${query.get('isolation') === 'none' ? location.origin : COURSE_ORIGIN}/wrapper/wrapper.html`,
                bridgeProtocolVersion: 1,
              };
            },
          },
  };
}
