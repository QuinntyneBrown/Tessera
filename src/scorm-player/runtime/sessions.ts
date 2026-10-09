import { ScormEdition } from '../types';
import { RuntimeSession } from './runtime-session';
import { Scorm2004Session } from './scorm2004-session';
import { NavigationValidity } from './sequencing-engine';

/** One SCO's runtime session, under the rules of its course's edition. */
export type ScormSession = RuntimeSession | Scorm2004Session;

export function createSession(
  edition: ScormEdition,
  navigation: NavigationValidity | null = null,
): ScormSession {
  return edition === '1.2' ? new RuntimeSession() : new Scorm2004Session(edition, navigation);
}
