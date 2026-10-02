import { PackageLimits } from '../types';

/** Limits applied when the host supplies none. */
export const DEFAULT_LIMITS: PackageLimits = {
  archiveBytes: 100 * 1024 * 1024,
  expandedBytes: 500 * 1024 * 1024,
  entryCount: 10_000,
};
