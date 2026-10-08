import { Component, signal } from '@angular/core';
import { VideoPlayer } from '@tessera/video-player';
import {
  VideoPlayerCustomTransportExample,
  VideoPlayerExamples,
} from '../../../components-examples/tessera/video-player';

/** The demonstration backend; `?backend=` points the page at another origin. */
const BACKEND = new URLSearchParams(location.search).get('backend') ?? 'http://localhost:5180';

/**
 * Plays the demonstration backend's streams over SignalR when it answers GET /demo/token, and
 * otherwise replays the committed fixture file with a notice.
 */
@Component({
  selector: 'tsr-video-player-demo',
  imports: [VideoPlayer, VideoPlayerCustomTransportExample, VideoPlayerExamples],
  styles: ['section {max-width: 48rem; margin: 1rem auto; padding: 1rem;}'],
  template: `
    <section>
      <h2>Video player</h2>
      @switch (mode()) {
        @case ('backend') {
          <p>Playing from the demonstration backend at {{ backend }}.</p>
          <label>
            Stream
            <select (change)="streamId.set($any($event.target).value)">
              <option value="lecture-hall-a">Lecture hall A (looping)</option>
              <option value="lab-camera-short">Lab camera (ends)</option>
            </select>
          </label>
          <t-video-player
            [hubUrl]="backend + '/hubs/video'"
            [streamId]="streamId()"
            [accessTokenFactory]="token"
          />
        }
        @case ('fixture') {
          <p role="status">Demonstration backend not running; using the fixture stream.</p>
          <tsr-video-player-custom-transport-example />
        }
        @default {
          <p>Looking for the demonstration backend…</p>
        }
      }
    </section>
    <tsr-video-player-examples />
  `,
})
export class VideoPlayerDemo {
  readonly backend = BACKEND;
  readonly mode = signal<'probing' | 'backend' | 'fixture'>('probing');
  readonly streamId = signal('lecture-hall-a');
  private demoToken = '';
  /** The player asks for the token on every connection; it never stores it. */
  readonly token = () => this.demoToken;

  constructor() {
    fetch(`${BACKEND}/demo/token`)
      .then((response) => (response.ok ? response.json() : Promise.reject(response.status)))
      .then((body: { token: string }) => {
        this.demoToken = body.token;
        this.mode.set('backend');
      })
      .catch(() => this.mode.set('fixture'));
  }
}
