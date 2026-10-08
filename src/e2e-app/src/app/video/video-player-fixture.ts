import { Component, Directive, signal } from '@angular/core';
import {
  VIDEO_PLAYER_I18N,
  VIDEO_STREAM_TRANSPORT,
  VideoPlayerI18n,
  VideoPlayer,
  VideoPlayerCaptions,
  VideoPlayerError,
  VideoPlayerState,
  VideoPlayerStats,
} from '@tessera/video-player';
import { FixtureVideoStreamTransport } from './fixture-video-stream-transport';

const parameters = new URLSearchParams(location.search);

/** A partial French override; every other key keeps its English default. */
const FRENCH: VideoPlayerI18n = {
  regionLabel: (title) => (title ? `Lecteur vidéo : ${title}` : 'Lecteur vidéo'),
  controlsLabel: 'Commandes du lecteur',
  mute: 'Couper le son',
  live: 'Direct',
  liveBadge: 'DIRECT',
  connecting: (title) => `Connexion à ${title}.`,
  liveAnnounced: 'En direct.',
  unmuted: (volume) => `Son à ${volume} %.`,
  behindLive: (seconds) => `${seconds} s de retard.`,
  reconnecting: (attempt, max) => `Tentative ${attempt} sur ${max}`,
  duration: (seconds) => `${Math.floor(seconds / 60)} min`,
  endedAfter: (duration) => `Terminé après ${duration}.`,
};

/** Gives the player on the same element its own fixture transport, as a hub connection would. */
@Directive({
  selector: '[tsrFixtureTransport]',
  providers: [
    {
      provide: VIDEO_STREAM_TRANSPORT,
      useFactory: () => new FixtureVideoStreamTransport(parameters),
    },
  ],
})
export class FixtureTransport {}

/** Production-component host for the video player acceptance suite; grows with each slice. */
@Component({
  selector: 'tsr-video-player-fixture',
  imports: [VideoPlayer, FixtureTransport],
  providers: [
    {
      provide: VIDEO_PLAYER_I18N,
      useFactory: () => (parameters.get('localized') === 'true' ? FRENCH : {}),
    },
  ],
  styles: ['output { display: block; overflow-wrap: anywhere; }'],
  template: `
    <main>
      <h1>Video player</h1>
      <div class="fixture-container" [attr.style]="containerStyle">
        @if (mounted()) {
          <t-video-player
            tsrFixtureTransport
            [hubUrl]="hubUrl"
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
        @if (parameters.get('instances') === '2') {
          <t-video-player
            tsrFixtureTransport
            hubUrl="https://hub.example/hubs/video"
            streamId="lab-camera"
            titleOverride="Lab camera"
          />
        }
      </div>
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
      <output aria-label="Error causes">{{ json(causes()) }}</output>
      <output aria-label="Stats">{{ json(stats()) }}</output>
    </main>
  `,
})
export class VideoPlayerFixture {
  readonly parameters = parameters;
  readonly streamId = signal(parameters.get('scenario') === 'idle' ? null : 'lecture-hall-a');
  readonly states = signal<VideoPlayerState[]>([]);
  readonly mounted = signal(true);
  readonly tokenFactory = () => 'fixture-token-7f3a';
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
  readonly hubUrl = parameters.get('hubUrl') ?? 'https://hub.example/hubs/video';
  /** The container width and the theme tokens a host page might set around the player. */
  readonly containerStyle =
    (parameters.has('containerWidth') ? `width: ${parameters.get('containerWidth')}px; ` : '') +
    (parameters.get('themed') === 'shared'
      ? '--t-colorNeutralBackground1: rgb(10, 20, 30); --t-colorNeutralForeground1: rgb(250, 240, 230);' +
        ' --t-colorStrokeFocus2: rgb(255, 200, 0); --t-colorNeutralBackground2: rgb(40, 50, 60);'
      : parameters.get('themed') === 'component'
        ? '--t-colorBrandBackground: rgb(1, 2, 3); --t-video-player-accent: rgb(4, 5, 6);'
        : '');

  constructor() {
    // Lets a test change inputs without moving focus out of the player.
    (window as unknown as { __videoFixtureHost: unknown }).__videoFixtureHost = {
      clearCaptions: () => this.captions.set(null),
    };
  }

  setCaptionSource(src: string): void {
    this.captions.update((captions) => captions && { ...captions, src });
  }

  recordStats(stats: VideoPlayerStats): void {
    this.stats.update(({ count }) => ({ count: count + 1, last: stats }));
  }

  readonly causes = signal<string[]>([]);

  recordError({ code, message, cause }: VideoPlayerError): void {
    this.errors.update((errors) => [...errors, { code, message }]);
    this.causes.update((causes) => [...causes, String(cause)]);
  }

  record(state: VideoPlayerState): void {
    this.states.update((states) => [...states, state]);
  }
}
