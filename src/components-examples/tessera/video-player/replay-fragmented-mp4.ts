import { Observable } from 'rxjs';
import type { VideoChunk } from '@tessera/video-player';
import { FragmentedMp4, shiftFragment, splitFragmentedMp4 } from './fmp4-boxes';

const files = new Map<string, Promise<FragmentedMp4>>();

/** Fetches and splits a fragmented MP4 file once per URL. */
export function loadFragmentedMp4(url: string): Promise<FragmentedMp4> {
  if (!files.has(url))
    files.set(
      url,
      fetch(url)
        .then((response) => response.arrayBuffer())
        .then((buffer) => splitFragmentedMp4(new Uint8Array(buffer))),
    );
  return files.get(url)!;
}

/**
 * Emits one tick per interval from a dedicated worker, so a page's fake clock cannot pause it.
 * A data URL keeps the worker out of the page's object URL bookkeeping.
 */
export function metronome(intervalMs: number): Observable<void> {
  return new Observable<void>((subscriber) => {
    const source = `setInterval(() => postMessage(0), ${Math.max(1, Math.round(intervalMs))});`;
    const worker = new Worker('data:text/javascript,' + encodeURIComponent(source));
    worker.onmessage = () => subscriber.next();
    return () => worker.terminate();
  });
}

/** Options for {@link replayFragmentedMp4}. */
export interface ReplayOptions {
  /** Fragments per second; defaults to 1. */
  rate?: number;
}

/**
 * Replays a fragmented MP4 file as a never-ending live stream: the initialisation chunk, then one
 * fragment per tick, looping with timestamps shifted so the timeline keeps growing.
 */
export function replayFragmentedMp4(
  url: string,
  options: ReplayOptions = {},
): Observable<VideoChunk> {
  return new Observable<VideoChunk>((subscriber) => {
    let seq = 0;
    let index = 0;
    let file: FragmentedMp4 | undefined;
    const emitFragment = () => {
      if (!file) return;
      const loop = Math.floor(index / file.fragments.length);
      const fragment = file.fragments[index % file.fragments.length];
      index++;
      seq++;
      subscriber.next({ kind: 1, seq, data: shiftFragment(fragment, loop, file.periods, seq) });
    };
    const ticks = metronome(1000 / (options.rate ?? 1)).subscribe(emitFragment);
    loadFragmentedMp4(url).then(
      (loaded) => {
        if (subscriber.closed) return;
        file = loaded;
        subscriber.next({ kind: 0, seq: 0, data: loaded.init });
        emitFragment();
      },
      (error) => subscriber.error(error),
    );
    return () => ticks.unsubscribe();
  });
}
