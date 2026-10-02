import { checkIntegration } from './integration-guard';
import { AttemptContext, CourseSource, HostIntegration } from './types';

const source: CourseSource = {
  kind: 'manifest',
  manifestUrl: 'https://course.test/imsmanifest.xml',
};
const attempt: AttemptContext = { attemptKey: 'a', courseKey: 'c', courseRevision: '1' };
const host: HostIntegration = {
  loadAttempt: async () => null,
  saveState: async (_context, submission) => ({ revision: submission.revision }),
  prepareDelivery: async () => {
    throw new Error('unused');
  },
};

describe('checkIntegration', () => {
  it('accepts complete inputs', () => {
    expect(checkIntegration({ source, attempt, host })).toBeNull();
  });

  it('reports a missing attempt as a non-retryable integration error', () => {
    const error = checkIntegration({ source, attempt: undefined, host });
    expect(error).toMatchObject({
      category: 'integration',
      code: 'attempt-missing',
      retryable: false,
    });
    expect(error?.text).toMatch(/attempt/i);
    expect(error?.correlationToken).toBeTruthy();
  });

  it('reports a missing source', () => {
    expect(checkIntegration({ source: undefined, attempt, host })?.code).toBe('source-missing');
  });

  it('reports a missing host', () => {
    expect(checkIntegration({ source, attempt, host: undefined })?.code).toBe('host-missing');
  });

  it('reports a host lacking a persistence function', () => {
    const partial = { ...host, saveState: undefined } as unknown as HostIntegration;
    expect(checkIntegration({ source, attempt, host: partial })?.code).toBe('host-incomplete');
  });

  it('reports an attempt context with an empty key', () => {
    const blank = { ...attempt, attemptKey: '' };
    expect(checkIntegration({ source, attempt: blank, host })?.code).toBe('attempt-missing');
  });
});
