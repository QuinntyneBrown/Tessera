import { MAX_MESSAGE_BYTES, parseWrapperMessage } from './bridge-protocol';

describe('parseWrapperMessage', () => {
  it('accepts a ready message', () => {
    expect(parseWrapperMessage({ v: 1, kind: 'ready' })).toEqual({ v: 1, kind: 'ready' });
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
