import { Component, OnDestroy, signal } from '@angular/core';
import {
  VIDEO_PLAYER_I18N,
  VIDEO_STREAM_TRANSPORT,
  VideoPlayer,
  VideoPlayerCaptions,
  VideoPlayerI18n,
} from '@tessera/video-player';
import { ReplayVideoStreamTransport } from './replay-video-stream-transport';

/** Connects to a SignalR hub with the default transport once the viewer asks for it. */
@Component({
  selector: 'tsr-video-player-basic-example',
  imports: [VideoPlayer],
  template: `
    <t-video-player
      hubUrl="http://localhost:5180/hubs/video"
      [streamId]="streamId()"
      [accessTokenFactory]="token"
    />
    <button type="button" (click)="streamId.set('lecture-hall-a')">Connect to the hub</button>
  `,
})
export class VideoPlayerBasicExample {
  readonly streamId = signal<string | null>(null);
  /** The host's token source; the player passes it to the transport only. */
  readonly token = () =>
    fetch('http://localhost:5180/demo/token')
      .then((r) => r.json())
      .then((body) => body.token);
}

/** Replaces SignalR with an in-memory transport that replays a file. */
@Component({
  selector: 'tsr-video-player-custom-transport-example',
  imports: [VideoPlayer],
  providers: [
    { provide: VIDEO_STREAM_TRANSPORT, useFactory: () => new ReplayVideoStreamTransport() },
  ],
  template: `<t-video-player streamId="lecture-hall-a" [muted]="true" />`,
})
export class VideoPlayerCustomTransportExample {}

/** Supplies a WebVTT caption track; cue times follow the stream's media timeline. */
@Component({
  selector: 'tsr-video-player-captions-example',
  imports: [VideoPlayer],
  providers: [
    { provide: VIDEO_STREAM_TRANSPORT, useFactory: () => new ReplayVideoStreamTransport() },
  ],
  template: `<t-video-player streamId="lecture-hall-a" [autoplay]="false" [captions]="captions" />`,
})
export class VideoPlayerCaptionsExample implements OnDestroy {
  private readonly vtt = URL.createObjectURL(
    new Blob(['WEBVTT\n\n00:00:00.000 --> 10:00:00.000\nWelcome to lecture hall A.\n'], {
      type: 'text/vtt',
    }),
  );
  readonly captions: VideoPlayerCaptions = { src: this.vtt, srclang: 'en', label: 'English' };

  ngOnDestroy(): void {
    URL.revokeObjectURL(this.vtt);
  }
}

/** Overrides some strings; every other string keeps its English default. */
const SPANISH: VideoPlayerI18n = {
  regionLabel: (title) => (title ? `Reproductor de vídeo: ${title}` : 'Reproductor de vídeo'),
  controlsLabel: 'Controles del reproductor',
  play: 'Reproducir',
  pause: 'Pausa',
  mute: 'Silenciar',
  unmute: 'Activar sonido',
  live: 'En directo',
  liveBadge: 'EN DIRECTO',
};

@Component({
  selector: 'tsr-video-player-i18n-example',
  imports: [VideoPlayer],
  providers: [
    { provide: VIDEO_STREAM_TRANSPORT, useFactory: () => new ReplayVideoStreamTransport() },
    { provide: VIDEO_PLAYER_I18N, useValue: SPANISH },
  ],
  template: `<t-video-player streamId="lecture-hall-a" [autoplay]="false" />`,
})
export class VideoPlayerI18nExample {}

/** Component tokens override the shared Tessera theme for this player only. */
@Component({
  selector: 'tsr-video-player-themed-example',
  imports: [VideoPlayer],
  providers: [
    { provide: VIDEO_STREAM_TRANSPORT, useFactory: () => new ReplayVideoStreamTransport() },
  ],
  styles: [
    ':host { display: block; --t-video-player-accent: #7a3e9d; --t-video-player-accent-fg: #ffffff; --t-video-player-radius: 0; }',
  ],
  template: `<t-video-player streamId="lecture-hall-a" [autoplay]="false" />`,
})
export class VideoPlayerThemedExample {}

/** Runnable adoption examples shared by the dev app and the acceptance screen. */
@Component({
  selector: 'tsr-video-player-examples',
  imports: [
    VideoPlayerBasicExample,
    VideoPlayerCustomTransportExample,
    VideoPlayerCaptionsExample,
    VideoPlayerI18nExample,
    VideoPlayerThemedExample,
  ],
  styles: [
    'main {max-width: 48rem; margin: 1rem auto; padding: 1rem;} section {margin-block: 2rem;}',
  ],
  template: `
    <main>
      <h1>Video player examples</h1>
      <section>
        <h2>Hub connection</h2>
        <tsr-video-player-basic-example />
      </section>
      <section>
        <h2>Custom transport</h2>
        <tsr-video-player-custom-transport-example />
      </section>
      <section>
        <h2>Captions</h2>
        <tsr-video-player-captions-example />
      </section>
      <section>
        <h2>Localised strings</h2>
        <tsr-video-player-i18n-example />
      </section>
      <section>
        <h2>Themed player</h2>
        <tsr-video-player-themed-example />
      </section>
    </main>
  `,
})
export class VideoPlayerExamples {}
