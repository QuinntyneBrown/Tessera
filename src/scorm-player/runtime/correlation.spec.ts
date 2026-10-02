import { AttemptContext } from '../types';
import { correlationTokenFor } from './correlation';

const attempt: AttemptContext = {
  attemptKey: 'learner-secret-key',
  courseKey: 'c1',
  courseRevision: '3',
};

describe('correlationTokenFor', () => {
  it('is stable for one attempt, so a host can correlate its errors', () => {
    expect(correlationTokenFor(attempt)).toBe(correlationTokenFor({ ...attempt }));
  });

  it('differs between attempts, courses and revisions', () => {
    const token = correlationTokenFor(attempt);

    expect(correlationTokenFor({ ...attempt, attemptKey: 'other' })).not.toBe(token);
    expect(correlationTokenFor({ ...attempt, courseKey: 'c2' })).not.toBe(token);
    expect(correlationTokenFor({ ...attempt, courseRevision: '4' })).not.toBe(token);
  });

  it('does not reveal the attempt context', () => {
    const token = correlationTokenFor(attempt);

    expect(token).toMatch(/^[0-9a-f]{16}$/);
    expect(token).not.toContain('learner');
  });
});
