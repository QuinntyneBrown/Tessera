import { RuntimeSession } from './runtime-session';

function initialized(): RuntimeSession {
  const session = new RuntimeSession();
  session.initialize('');
  return session;
}

describe('RuntimeSession lifecycle', () => {
  it('rejects data calls before initialization with error 301', () => {
    const session = new RuntimeSession();

    expect(session.getValue('cmi.core.lesson_location')).toBe('');
    expect(session.lastError).toBe('301');
    expect(session.setValue('cmi.core.lesson_location', 'x')).toBe('false');
    expect(session.lastError).toBe('301');
    expect(session.commit('')).toBe('false');
    expect(session.lastError).toBe('301');
    expect(session.terminate('')).toBe('false');
    expect(session.lastError).toBe('301');
  });

  it('initializes once and then reports a general exception (101)', () => {
    const session = new RuntimeSession();

    expect(session.initialize('')).toBe('true');
    expect(session.lastError).toBe('0');
    expect(session.initialize('')).toBe('false');
    expect(session.lastError).toBe('101');
  });

  it.each([
    ['initialize', (s: RuntimeSession) => s.initialize('x')],
    ['commit', (s: RuntimeSession) => (s.initialize(''), s.commit('x'))],
    ['terminate', (s: RuntimeSession) => (s.initialize(''), s.terminate('x'))],
  ])('rejects a non-empty argument to %s with error 201', (_name, call) => {
    const session = new RuntimeSession();

    expect(call(session)).toBe('false');
    expect(session.lastError).toBe('201');
  });

  it('rejects data calls after termination with error 301 and refuses re-initialization', () => {
    const session = initialized();

    expect(session.terminate('')).toBe('true');
    expect(session.getValue('cmi.core.lesson_location')).toBe('');
    expect(session.lastError).toBe('301');
    expect(session.initialize('')).toBe('false');
    expect(session.lastError).toBe('101');
  });

  it('clears the last error on the next successful call', () => {
    const session = new RuntimeSession();
    session.getValue('cmi.core.lesson_location');
    expect(session.lastError).toBe('301');

    session.initialize('');

    expect(session.lastError).toBe('0');
  });

  it('reports an unknown element as an invalid argument (201)', () => {
    const session = initialized();

    expect(session.getValue('cmi.bogus')).toBe('');
    expect(session.lastError).toBe('201');
    expect(session.setValue('cmi.bogus', 'x')).toBe('false');
    expect(session.lastError).toBe('201');
  });

  it('describes error codes without disturbing the last error', () => {
    const session = new RuntimeSession();
    session.getValue('cmi.core.lesson_location');

    expect(session.errorString('301')).toBe('Not initialized');
    expect(session.errorString('999')).toBe('');
    expect(session.diagnostic('301')).toBe('Not initialized');
    expect(session.lastError).toBe('301');
  });
});
