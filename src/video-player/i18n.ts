import { InjectionToken } from '@angular/core';

/** Every user-visible or assistive-technology string the video player owns. */
export interface VideoPlayerStrings {
  regionLabel: (title: string | null) => string;
  connectingStatus: string;
  connecting: (title: string) => string;
  liveAnnounced: string;
  retry: string;
  errorUnsupported: (mimeType: string) => string;
  errorUnauthorized: string;
  errorNotFound: string;
  errorConnection: string;
  errorSource: string;
  errorDecode: string;
  errorStalled: string;
}

/** English defaults; consumers can replace any subset through VIDEO_PLAYER_I18N. */
export const DEFAULT_VIDEO_PLAYER_STRINGS: VideoPlayerStrings = {
  regionLabel: (title) => (title ? `Video player: ${title}` : 'Video player'),
  connectingStatus: 'Connecting…',
  connecting: (title) => `Connecting to ${title}.`,
  liveAnnounced: 'Live.',
  retry: 'Retry',
  errorUnsupported: (mimeType) => `This browser can't play this stream (${mimeType}).`,
  errorUnauthorized: "You don't have access to this stream. Sign in again or ask the organiser.",
  errorNotFound: "This stream doesn't exist or is no longer available.",
  errorConnection: "The connection was lost and couldn't be restored.",
  errorSource: 'The video source stopped unexpectedly.',
  errorDecode: "The video couldn't be decoded.",
  errorStalled: 'The source stopped sending video.',
};

/** Partial string overrides merged over the English defaults. */
export type VideoPlayerI18n = Partial<VideoPlayerStrings>;

/** Provides partial string overrides for every video player below the provider. */
export const VIDEO_PLAYER_I18N = new InjectionToken<VideoPlayerI18n>('VIDEO_PLAYER_I18N', {
  providedIn: 'root',
  factory: () => ({}),
});
