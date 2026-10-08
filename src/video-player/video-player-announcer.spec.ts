import { VideoPlayerAnnouncer } from './video-player-announcer';

describe('VideoPlayerAnnouncer', () => {
  let region: HTMLElement;
  let announcer: VideoPlayerAnnouncer;
  let writes: string[];

  beforeEach(() => {
    vi.useFakeTimers();
    region = document.createElement('div');
    writes = [];
    new MutationObserver(() => writes.push(region.textContent ?? '')).observe(region, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    announcer = new VideoPlayerAnnouncer(() => region);
  });

  afterEach(() => {
    announcer.destroy();
    vi.useRealTimers();
  });

  async function flush(milliseconds: number): Promise<void> {
    vi.advanceTimersByTime(milliseconds);
    await Promise.resolve();
  }

  it('writes only the last of several status messages within 150 ms', async () => {
    announcer.status('Connecting to Lecture hall A.');
    await flush(100);
    announcer.status('Live.');
    await flush(49);
    expect(region.textContent).toBe('');
    await flush(1);
    expect(writes).toEqual(['Live.']);
  });

  it('writes a toggle at once and still writes the pending status afterwards', async () => {
    announcer.status('Live.');
    announcer.toggle('Muted.');
    await flush(0);
    expect(region.textContent).toBe('Muted.');
    await flush(150);
    expect(writes).toEqual(['Muted.', 'Live.']);
  });

  it('cancels a pending status and empties the region on clear', async () => {
    announcer.toggle('Muted.');
    announcer.status('Buffering.');
    announcer.clear();
    await flush(500);
    expect(region.textContent).toBe('');
  });
});
