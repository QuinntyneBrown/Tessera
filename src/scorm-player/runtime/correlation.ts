import { AttemptContext } from '../types';

/**
 * A stable, opaque token that lets a host correlate the errors of one attempt without the player
 * putting the attempt context into diagnostics (FNV-1a, 64 bit).
 */
export function correlationTokenFor(attempt: AttemptContext): string {
  const text = [attempt.attemptKey, attempt.courseKey, attempt.courseRevision].join('\u0000');
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(text)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}
