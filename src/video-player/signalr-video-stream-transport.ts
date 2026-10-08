import { HubConnection, HubConnectionBuilder } from '@microsoft/signalr';
import { MessagePackHubProtocol } from '@microsoft/signalr-protocol-msgpack';
import { Observable, Subject } from 'rxjs';
import { VideoChunk, VideoStreamDescriptor, VideoStreamTransportOptions } from './types';
import { VideoStreamTransport } from './video-stream-transport';

/** The reconnect delays of L2-067, in milliseconds. */
const RECONNECT_DELAYS = [0, 2000, 5000, 10000, 10000];

/**
 * The default transport: one SignalR hub connection with the MessagePack protocol. Every player
 * that has no VIDEO_STREAM_TRANSPORT provider creates its own instance, so it owns its connection.
 */
export class SignalRVideoStreamTransport implements VideoStreamTransport {
  readonly connectionEvents = new Subject<'reconnecting' | 'reconnected' | 'closed'>();
  private options: VideoStreamTransportOptions = { hubUrl: null };
  private connection: Promise<HubConnection> | undefined;

  /** `createBuilder` exists for tests; consumers use the default. */
  constructor(
    private readonly createBuilder: () => HubConnectionBuilder = () => new HubConnectionBuilder(),
  ) {}

  configure(options: VideoStreamTransportOptions): void {
    this.options = options;
  }

  async describe(streamId: string): Promise<VideoStreamDescriptor> {
    const connection = await this.connect();
    try {
      return toDescriptor(await connection.invoke('Describe', streamId));
    } catch (error) {
      throw redact(error);
    }
  }

  subscribe(streamId: string): Observable<VideoChunk> {
    return new Observable<VideoChunk>((subscriber) => {
      let dispose: (() => void) | undefined;
      let closed = false;
      this.connect().then(
        (connection) => {
          if (closed) return;
          const stream = connection.stream<unknown>('Subscribe', streamId).subscribe({
            next: (item) => subscriber.next(toChunk(item)),
            complete: () => subscriber.complete(),
            error: (error) => subscriber.error(redact(error)),
          });
          dispose = () => stream.dispose();
        },
        (error) => subscriber.error(error),
      );
      return () => {
        closed = true;
        dispose?.();
      };
    });
  }

  async stop(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    await (await connection?.catch(() => undefined))?.stop();
  }

  /** Builds and starts the connection on first use; a failed start is forgotten. */
  private connect(): Promise<HubConnection> {
    this.connection ??= this.start().catch((error) => {
      this.connection = undefined;
      throw redact(error);
    });
    return this.connection;
  }

  private async start(): Promise<HubConnection> {
    const connection = this.createBuilder()
      .withUrl(this.options.hubUrl ?? '', { accessTokenFactory: this.options.accessTokenFactory })
      .withHubProtocol(new MessagePackHubProtocol())
      .withAutomaticReconnect(RECONNECT_DELAYS)
      .build();
    connection.onreconnecting(() => this.connectionEvents.next('reconnecting'));
    connection.onreconnected(() => this.connectionEvents.next('reconnected'));
    connection.onclose(() => this.connectionEvents.next('closed'));
    await connection.start();
    return connection;
  }
}

/** The hub's integer-keyed MessagePack objects arrive as arrays. */
function toDescriptor(value: unknown): VideoStreamDescriptor {
  if (!Array.isArray(value)) return value as VideoStreamDescriptor;
  const [streamId, title, mimeType, startedAt, width, height] = value;
  return { streamId, title, mimeType, startedAt, width, height };
}

function toChunk(value: unknown): VideoChunk {
  if (!Array.isArray(value)) return value as VideoChunk;
  const [kind, seq, data] = value;
  return { kind, seq, data };
}

/** Keeps an error's message and status code but never an access token from a URL inside it. */
function redact(error: unknown): unknown {
  if (!(error instanceof Error)) return error;
  const message = error.message.replace(/access_token=[^&\s]*/g, 'access_token=[redacted]');
  if (message === error.message) return error;
  return Object.assign(new Error(message), {
    statusCode: (error as { statusCode?: number }).statusCode,
  });
}
