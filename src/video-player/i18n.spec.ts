import { DEFAULT_VIDEO_PLAYER_STRINGS, formatDuration } from './i18n';

describe('formatDuration', () => {
  it.each([
    [0, 'less than a minute'],
    [59, 'less than a minute'],
    [60, '1 minute'],
    [125, '2 minutes'],
    [3600, '1 hour 0 minutes'],
    [7260, '2 hours 1 minute'],
  ])('describes %i seconds as "%s"', (seconds, words) => {
    expect(formatDuration(seconds)).toBe(words);
  });
});

describe('DEFAULT_VIDEO_PLAYER_STRINGS', () => {
  it('passes numbers to the function strings', () => {
    const strings = DEFAULT_VIDEO_PLAYER_STRINGS;
    expect(strings.unmuted(60)).toBe('Unmuted, volume 60%.');
    expect(strings.reconnecting(2, 5)).toBe('Reconnecting… attempt 2 of 5');
    expect(strings.behindLive(10)).toBe('10 seconds behind live. Press Live to catch up.');
    expect(strings.endedAfter(strings.duration(125))).toBe(
      'Stream ended. It was live for 2 minutes.',
    );
  });
});
