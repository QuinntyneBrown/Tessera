import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import { SignalRVideoStreamTransport } from './signalr-video-stream-transport';

/** A HubConnection double that records calls and lets a test drive its callbacks. */
function createHub() {
  const handlers: Record<string, (() => void)[]> = { reconnecting: [], reconnected: [], close: [] };
  const streams: {
    method: string;
    args: unknown[];
    observer?: Record<string, (v?: unknown) => void>;
    disposed: boolean;
  }[] = [];
  const hub = {
    calls: [] as string[],
    streams,
    start: vi.fn(async () => void hub.calls.push('start')),
    stop: vi.fn(async () => void hub.calls.push('stop')),
    invoke: vi.fn(async (method: string, ...args: unknown[]) => {
      hub.calls.push(`invoke:${method}:${args.join(',')}`);
      return ['lecture-hall-a', 'Lecture hall A', 'video/mp4', '2026-10-07T10:00:00Z', 1280, 720];
    }),
    stream: vi.fn((method: string, ...args: unknown[]) => {
      hub.calls.push(`stream:${method}:${args.join(',')}`);
      const entry: (typeof streams)[number] = { method, args, disposed: false };
      streams.push(entry);
      return {
        subscribe(observer: Record<string, (v?: unknown) => void>) {
          entry.observer = observer;
          return { dispose: () => (entry.disposed = true) };
        },
      };
    }),
    onreconnecting: (callback: () => void) => handlers['reconnecting'].push(callback),
    onreconnected: (callback: () => void) => handlers['reconnected'].push(callback),
    onclose: (callback: () => void) => handlers['close'].push(callback),
    emit: (event: string) => handlers[event].forEach((callback) => callback()),
  };
  return hub;
}

/** A HubConnectionBuilder double that records the configuration it receives. */
function createBuilder(hub: ReturnType<typeof createHub>) {
  const builder = {
    url: '',
    options: undefined as { accessTokenFactory?: () => string | Promise<string> } | undefined,
    protocol: undefined as unknown,
    reconnect: undefined as number[] | undefined,
    withUrl(url: string, options: { accessTokenFactory?: () => string | Promise<string> }) {
      builder.url = url;
      builder.options = options;
      return builder;
    },
    withHubProtocol(protocol: unknown) {
      builder.protocol = protocol;
      return builder;
    },
    withAutomaticReconnect(delays: number[]) {
      builder.reconnect = delays;
      return builder;
    },
    build: () => hub,
  };
  return builder;
}

describe('SignalRVideoStreamTransport', () => {
  let hubs: ReturnType<typeof createHub>[];
  let builders: ReturnType<typeof createBuilder>[];
  let transport: SignalRVideoStreamTransport;
  const tokenFactory = () => 'secret-token';

  beforeEach(() => {
    hubs = [];
    builders = [];
    transport = new SignalRVideoStreamTransport(() => {
      const hub = createHub();
      hubs.push(hub);
      const builder = createBuilder(hub);
      builders.push(builder);
      return builder as never;
    });
    transport.configure({
      hubUrl: 'wss://hub.example/hubs/video?tenant=a b',
      accessTokenFactory: tokenFactory,
    });
  });

  it('builds the connection with MessagePack, the hub URL verbatim, the token factory and the schedule', async () => {
    await transport.describe('lecture-hall-a');
    expect(builders[0].protocol).toBeInstanceOf(MessagePackHubProtocol);
    expect(builders[0].url).toBe('wss://hub.example/hubs/video?tenant=a b');
    expect(builders[0].options?.accessTokenFactory).toBe(tokenFactory);
    expect(builders[0].reconnect).toEqual([0, 2000, 5000, 10000, 10000]);
  });

  it('starts once, invokes Describe before Subscribe, and maps integer-keyed messages', async () => {
    const descriptor = await transport.describe('lecture-hall-a');
    const chunks: unknown[] = [];
    transport.subscribe('lecture-hall-a').subscribe((chunk) => chunks.push(chunk));
    await Promise.resolve();
    await Promise.resolve();
    hubs[0].streams[0].observer!['next']([0, 0, new Uint8Array([1, 2])]);
    expect(hubs[0].calls).toEqual([
      'start',
      'invoke:Describe:lecture-hall-a',
      'stream:Subscribe:lecture-hall-a',
    ]);
    expect(descriptor).toEqual({
      streamId: 'lecture-hall-a',
      title: 'Lecture hall A',
      mimeType: 'video/mp4',
      startedAt: '2026-10-07T10:00:00Z',
      width: 1280,
      height: 720,
    });
    expect(chunks).toEqual([{ kind: 0, seq: 0, data: new Uint8Array([1, 2]) }]);
  });

  it('forwards reconnecting, reconnected and closed as connection events', async () => {
    const events: string[] = [];
    transport.connectionEvents.subscribe((event) => events.push(event));
    await transport.describe('lecture-hall-a');
    hubs[0].emit('reconnecting');
    hubs[0].emit('reconnected');
    hubs[0].emit('close');
    expect(events).toEqual(['reconnecting', 'reconnected', 'closed']);
  });

  it('re-subscribes on the same connection after a reconnect', async () => {
    await transport.describe('lecture-hall-a');
    const first = transport.subscribe('lecture-hall-a').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    hubs[0].emit('reconnecting');
    hubs[0].emit('reconnected');
    first.unsubscribe();
    transport.subscribe('lecture-hall-a').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    expect(hubs).toHaveLength(1);
    expect(hubs[0].streams.map((stream) => stream.method)).toEqual(['Subscribe', 'Subscribe']);
  });

  it('disposes the server stream when the chunk observable is unsubscribed', async () => {
    await transport.describe('lecture-hall-a');
    const subscription = transport.subscribe('lecture-hall-a').subscribe();
    await Promise.resolve();
    await Promise.resolve();
    subscription.unsubscribe();
    expect(hubs[0].streams[0].disposed).toBe(true);
  });

  it('stops the connection and builds a fresh one for the next describe', async () => {
    await transport.describe('lecture-hall-a');
    await transport.stop();
    await transport.describe('lecture-hall-a');
    expect(hubs[0].stop).toHaveBeenCalled();
    expect(hubs).toHaveLength(2);
  });

  it('keeps the status code of a failed start and never repeats an access token', async () => {
    transport = new SignalRVideoStreamTransport(() => {
      const hub = createHub();
      hub.start.mockRejectedValue(
        Object.assign(
          new Error('Failed to negotiate: https://hub.example/negotiate?access_token=secret-token'),
          {
            statusCode: 401,
          },
        ),
      );
      return createBuilder(hub) as never;
    });
    transport.configure({
      hubUrl: 'https://hub.example/hubs/video',
      accessTokenFactory: tokenFactory,
    });
    const failure = await transport.describe('lecture-hall-a').catch((error) => error);
    expect(failure.statusCode).toBe(401);
    expect(String(failure.message)).not.toContain('secret-token');
  });
});
