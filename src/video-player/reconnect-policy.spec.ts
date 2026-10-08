import { ReconnectPolicy } from './reconnect-policy';

describe('ReconnectPolicy', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('reports attempts 1 to 5 at 0, 2, 7, 17 and 27 seconds and never a sixth', () => {
    const attempts: [number, number][] = [];
    const policy = new ReconnectPolicy();
    policy.start((attempt) => attempts.push([attempt, Date.now()]));
    const start = Date.now();
    vi.advanceTimersByTime(60000);
    expect(attempts.map(([attempt, time]) => [attempt, time - start])).toEqual([
      [1, 0],
      [2, 2000],
      [3, 7000],
      [4, 17000],
      [5, 27000],
    ]);
  });

  it('cancels the pending attempt on reset', () => {
    const attempts: number[] = [];
    const policy = new ReconnectPolicy();
    policy.start((attempt) => attempts.push(attempt));
    policy.reset();
    vi.advanceTimersByTime(60000);
    expect(attempts).toEqual([1]);
  });
});
