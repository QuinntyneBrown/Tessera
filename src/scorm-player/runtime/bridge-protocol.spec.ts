import { MAX_MESSAGE_BYTES, parseWrapperMessage } from './bridge-protocol';

describe('parseWrapperMessage', () => {
  it('accepts a ready message', () => {
    expect(parseWrapperMessage({ v: 1, kind: 'ready' })).toEqual({ v: 1, kind: 'ready' });
  });

  it('accepts a launch-failed message', () => {
    expect(parseWrapperMessage({ v: 1, kind: 'launch-failed' })).toEqual({
      v: 1,
      kind: 'launch-failed',
    });
  });

  it('accepts runtime operations', () => {
    for (const operation of [
      { kind: 'initialize' },
      { kind: 'set', element: 'cmi.core.lesson_location', value: 'p1' },
      { kind: 'commit' },
      { kind: 'terminate' },
    ]) {
      expect(parseWrapperMessage({ v: 1, kind: 'operation', operation })).toEqual({
        v: 1,
        kind: 'operation',
        operation,
      });
    }
  });

  it.each([
    [
      'an operation with a non-string value',
      { v: 1, kind: 'operation', operation: { kind: 'set', element: 'a', value: 1 } },
    ],
    ['an unknown operation', { v: 1, kind: 'operation', operation: { kind: 'format' } }],
    [
      'an operation with extra fields',
      { v: 1, kind: 'operation', operation: { kind: 'commit', extra: 1 } },
    ],
  ])('rejects %s', (_label, data) => {
    expect(parseWrapperMessage(data)).toBeNull();
  });

  it.each([
    ['a different protocol version', { v: 2, kind: 'ready' }],
    ['an unknown kind', { v: 1, kind: 'unknown' }],
    ['an unexpected extra field', { v: 1, kind: 'ready', extra: true }],
    ['a string', 'ready'],
    ['null', null],
    ['an oversized payload', { v: 1, kind: 'ready', pad: 'x'.repeat(MAX_MESSAGE_BYTES) }],
  ])('rejects %s', (_label, data) => {
    expect(parseWrapperMessage(data)).toBeNull();
  });
});
