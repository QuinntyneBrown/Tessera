import { Component, signal } from '@angular/core';
import {
  VIDEO_STREAM_TRANSPORT,
  VideoPlayer,
  VideoPlayerCaptions,
  VideoPlayerError,
  VideoPlayerState,
  VideoPlayerStats,
} from '@tessera/video-player';
import { FixtureVideoStreamTransport } from './fixture-video-stream-transport';

const parameters = new URLSearchParams(location.search);

/** Production-component host for the video player acceptance suite; grows with each slice. */
@Component({
  selector: 'tsr-video-player-fixture',
  imports: [VideoPlayer],
  providers: [
    {
      provide: VIDEO_STREAM_TRANSPORT,
      useFactory: () => new FixtureVideoStreamTransport(parameters),
    },
  ],
  styles: ['output { display: block; overflow-wrap: anywhere; }'],
  template: `
    <main>
      <h1>Video player</h1>
      @if (mounted()) {
        <t-video-player
          hubUrl="https://hub.example/hubs/video"
          [accessTokenFactory]="tokenFactory"
          [streamId]="streamId()"
          [titleOverride]="parameters.get('titleOverride') ?? undefined"
          [autoplay]="parameters.get('autoplay') !== 'false'"
          [muted]="muted()"
          [volume]="volume()"
          [captions]="captions()"
          (stateChange)="record($event)"
          (error)="recordError($event)"
          (stats)="recordStats($event)"
        />
      }
      <button type="button" (click)="mounted.set(false)">Unmount player</button>
      <button type="button" (click)="mounted.set(true)">Mount player</button>
      <button type="button" (click)="volume.set(40)">Set volume 40</button>
      <button type="button" (click)="muted.set(true)">Set muted</button>
      <button type="button" (click)="setCaptionSource('/captions-en-b.vtt')">
        Change caption source
      </button>
      <button type="button" (click)="captions.set(null)">Clear captions</button>
      <output aria-label="State changes">{{ json(states()) }}</output>
      <output aria-label="Errors">{{ json(errors()) }}</output>
      <output aria-label="Stats">{{ json(stats()) }}</output>
    </main>
  `,
})
export class VideoPlayerFixture {
  readonly parameters = parameters;
  readonly streamId = signal(parameters.get('scenario') === 'idle' ? null : 'lecture-hall-a');
  readonly states = signal<VideoPlayerState[]>([]);
  readonly mounted = signal(true);
  readonly tokenFactory = () => 'fixture-token';
  readonly muted = signal(parameters.get('muted') === 'true');
  readonly captions = signal<VideoPlayerCaptions | null>(
    parameters.get('captions') === 'true'
      ? { src: '/captions-en.vtt', srclang: 'en', label: 'English' }
      : null,
  );
  readonly volume = signal(Number(parameters.get('volume') ?? 100));
  readonly errors = signal<Pick<VideoPlayerError, 'code' | 'message'>[]>([]);
  readonly stats = signal<{ count: number; last: VideoPlayerStats | null }>({
    count: 0,
    last: null,
  });
  readonly json = JSON.stringify;

  setCaptionSource(src: string): void {
    this.captions.update((captions) => captions && { ...captions, src });
  }

  recordStats(stats: VideoPlayerStats): void {
    this.stats.update(({ count }) => ({ count: count + 1, last: stats }));
  }

  recordError({ code, message }: VideoPlayerError): void {
    this.errors.update((errors) => [...errors, { code, message }]);
  }

  record(state: VideoPlayerState): void {
    this.states.update((states) => [...states, state]);
  }
}
