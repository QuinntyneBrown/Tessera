import { Component, signal } from '@angular/core';
import {
  VIDEO_STREAM_TRANSPORT,
  VideoPlayer,
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
      <t-video-player
        hubUrl="https://hub.example/hubs/video"
        [streamId]="streamId()"
        [titleOverride]="parameters.get('titleOverride') ?? undefined"
        [autoplay]="parameters.get('autoplay') !== 'false'"
        [muted]="muted()"
        [volume]="volume()"
        (stateChange)="record($event)"
        (error)="recordError($event)"
        (stats)="recordStats($event)"
      />
      <button type="button" (click)="volume.set(40)">Set volume 40</button>
      <button type="button" (click)="muted.set(true)">Set muted</button>
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
  readonly muted = signal(parameters.get('muted') === 'true');
  readonly volume = signal(Number(parameters.get('volume') ?? 100));
  readonly errors = signal<Pick<VideoPlayerError, 'code' | 'message'>[]>([]);
  readonly stats = signal<{ count: number; last: VideoPlayerStats | null }>({
    count: 0,
    last: null,
  });
  readonly json = JSON.stringify;

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
