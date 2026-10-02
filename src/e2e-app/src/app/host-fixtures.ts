import { AttemptContext, CourseSource, HostIntegration } from '@tessera/scorm-player';

export interface HostFixture {
  source: CourseSource;
  attempt?: AttemptContext;
  host?: HostIntegration;
}

const COURSE_ORIGIN = 'http://127.0.0.1:4300';

/** Builds the host-side inputs for the scenario named by the page's query string. */
export function hostFixtureFor(query: URLSearchParams): HostFixture {
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
            saveState: async (_context, submission) => ({ revision: submission.revision }),
            prepareDelivery: async () => ({
              courseRoot: `${COURSE_ORIGIN}/courses/${courseName}/`,
              wrapperUrl: `${COURSE_ORIGIN}/wrapper/wrapper.html`,
              bridgeProtocolVersion: 1,
            }),
          },
  };
}
