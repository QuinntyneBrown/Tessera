import { AttemptContext, CourseSource, HostIntegration, PlayerError } from './types';

export interface PlayerInputs {
  readonly source: CourseSource | undefined;
  readonly attempt: AttemptContext | undefined;
  readonly host: HostIntegration | undefined;
}

const HOST_FUNCTIONS = ['loadAttempt', 'saveState', 'prepareDelivery'] as const;

function integrationError(code: string, text: string): PlayerError {
  return {
    category: 'integration',
    code,
    text,
    retryable: false,
    correlationToken: crypto.randomUUID(),
  };
}

/** Checks the required inputs before any request for course content. */
export function checkIntegration({ source, attempt, host }: PlayerInputs): PlayerError | null {
  if (!attempt?.attemptKey || !attempt.courseKey || !attempt.courseRevision) {
    return integrationError(
      'attempt-missing',
      'The course cannot start because the host did not supply an authorized attempt.',
    );
  }
  if (!source) {
    return integrationError(
      'source-missing',
      'The course cannot start because the host did not supply a course.',
    );
  }
  if (!host) {
    return integrationError(
      'host-missing',
      'The course cannot start because the host did not supply its persistence functions.',
    );
  }
  if (HOST_FUNCTIONS.some((name) => typeof host[name] !== 'function')) {
    return integrationError(
      'host-incomplete',
      'The course cannot start because the host persistence functions are incomplete.',
    );
  }
  return null;
}
