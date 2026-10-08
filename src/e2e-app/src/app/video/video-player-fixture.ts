import { Component, signal } from '@angular/core';
import {
  VIDEO_STREAM_TRANSPORT,
  VideoPlayer,
  VideoPlayerError,
  VideoPlayerState,
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
        (stateChange)="record($event)"
        (error)="recordError($event)"
      />
      <output aria-label="State changes">{{ json(states()) }}</output>
      <output aria-label="Errors">{{ json(errors()) }}</output>
    </main>
  `,
})
export class VideoPlayerFixture {
  readonly parameters = parameters;
  readonly streamId = signal(parameters.get('scenario') === 'idle' ? null : 'lecture-hall-a');
  readonly states = signal<VideoPlayerState[]>([]);
  readonly errors = signal<Pick<VideoPlayerError, 'code' | 'message'>[]>([]);
  readonly json = JSON.stringify;

  recordError({ code, message }: VideoPlayerError): void {
    this.errors.update((errors) => [...errors, { code, message }]);
  }

  record(state: VideoPlayerState): void {
    this.states.update((states) => [...states, state]);
  }
}
