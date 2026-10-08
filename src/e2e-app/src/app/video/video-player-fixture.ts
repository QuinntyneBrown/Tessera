import { Component, signal } from '@angular/core';
import { VideoPlayer, VideoPlayerState } from '@tessera/video-player';

/** Production-component host for the video player acceptance suite; grows with each slice. */
@Component({
  selector: 'tsr-video-player-fixture',
  imports: [VideoPlayer],
  styles: ['output { display: block; overflow-wrap: anywhere; }'],
  template: `
    <main>
      <h1>Video player</h1>
      <t-video-player (stateChange)="record($event)" />
      <output aria-label="State changes">{{ json(states()) }}</output>
    </main>
  `,
})
export class VideoPlayerFixture {
  readonly parameters = new URLSearchParams(location.search);
  readonly states = signal<VideoPlayerState[]>([]);
  readonly json = JSON.stringify;

  record(state: VideoPlayerState): void {
    this.states.update((states) => [...states, state]);
  }
}
