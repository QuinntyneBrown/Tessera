import { BRIDGE_PROTOCOL_VERSION } from './runtime/bridge-protocol';
import {
  AttemptContext,
  AttemptSnapshot,
  CourseSource,
  DeliveryDescriptor,
  HostIntegration,
  PlayerError,
  ValidatedCourse,
} from './types';

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

/** Checks that the host delivers the course from an origin isolated from the host application. */
export function checkDelivery(
  delivery: DeliveryDescriptor,
  hostOrigin: string,
): PlayerError | null {
  const wrapperOrigin = new URL(delivery.wrapperUrl).origin;
  if (
    wrapperOrigin === hostOrigin ||
    new URL(delivery.courseRoot).origin !== wrapperOrigin ||
    delivery.bridgeProtocolVersion !== BRIDGE_PROTOCOL_VERSION
  ) {
    return isolationUnavailable();
  }
  return null;
}

export function isolationUnavailable(): PlayerError {
  return integrationError(
    'isolation-unavailable',
    'The course cannot start because the host did not deliver it from an isolated origin.',
  );
}

/** Checks that saved state belongs to this attempt, course revision and edition before it is applied. */
export function checkSnapshot(
  snapshot: AttemptSnapshot,
  attempt: AttemptContext,
  course: ValidatedCourse,
): PlayerError | null {
  const { context } = snapshot;
  if (
    snapshot.schemaVersion === 1 &&
    snapshot.edition === course.edition &&
    context.attemptKey === attempt.attemptKey &&
    context.courseKey === attempt.courseKey &&
    context.courseRevision === attempt.courseRevision
  ) {
    return null;
  }
  return integrationError(
    'snapshot-mismatch',
    'The saved progress does not belong to this attempt, course or version, so the course was not started.',
  );
}
