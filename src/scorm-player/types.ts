export type ScormEdition = '1.2' | '2004-2nd' | '2004-3rd' | '2004-4th';

export type CourseSource =
  | { readonly kind: 'zip'; readonly file: File }
  | { readonly kind: 'manifest'; readonly manifestUrl: string };

/** Host-issued identity binding one learner, one course revision and one attempt. */
export interface AttemptContext {
  readonly attemptKey: string;
  readonly courseKey: string;
  readonly courseRevision: string;
}

export interface PackageLimits {
  readonly archiveBytes: number;
  readonly expandedBytes: number;
  readonly entryCount: number;
}

export interface ScoSnapshot {
  readonly values: Readonly<Record<string, string>>;
}

export interface SequencingState {
  readonly currentActivityId: string;
}

/** Versioned saved state for one course revision and host-authorized attempt. */
export interface AttemptSnapshot {
  readonly schemaVersion: number;
  readonly context: AttemptContext;
  readonly edition: ScormEdition;
  readonly scoStates: Readonly<Record<string, ScoSnapshot>>;
  readonly sequencing: SequencingState;
}

export interface SaveSubmission {
  readonly snapshot: AttemptSnapshot;
  readonly revision: number;
}

export interface SaveAck {
  readonly revision: number;
}

export interface ActivityResource {
  readonly kind: 'sco' | 'asset';
  readonly url: string;
}

export interface Activity {
  readonly id: string;
  readonly title: string;
  readonly resource: ActivityResource;
}

export interface ValidatedCourse {
  readonly edition: ScormEdition;
  readonly title: string;
  readonly activities: readonly Activity[];
}

export interface DeliveryDescriptor {
  readonly courseRoot: string;
  readonly wrapperUrl: string;
  readonly bridgeProtocolVersion: number;
}

export interface HostIntegration {
  loadAttempt(context: AttemptContext, signal: AbortSignal): Promise<AttemptSnapshot | null>;
  saveState(
    context: AttemptContext,
    submission: SaveSubmission,
    signal: AbortSignal,
  ): Promise<SaveAck>;
  prepareDelivery(
    context: AttemptContext,
    course: ValidatedCourse,
    signal: AbortSignal,
  ): Promise<DeliveryDescriptor>;
}

export type PlayerErrorCategory = 'integration' | 'loading' | 'runtime' | 'persistence';

export interface PlayerError {
  readonly category: PlayerErrorCategory;
  readonly code: string;
  readonly text: string;
  readonly retryable: boolean;
  readonly correlationToken: string;
}

/** A value the course has not reported enough data to determine. */
export type Unknown = 'unknown';

export interface Score {
  readonly raw?: number;
  readonly min?: number;
  readonly max?: number;
}

/** What the course has achieved; every field says explicitly when it is not yet known. */
export interface CourseOutcome {
  readonly status: string | Unknown;
  readonly completion: string | Unknown;
  readonly success: string | Unknown;
  readonly score: Score | Unknown;
  readonly progress: number | Unknown;
}

export type PlayerEvent =
  | { readonly kind: 'error'; readonly error: PlayerError }
  | { readonly kind: 'save'; readonly status: 'saved'; readonly revision: number }
  | { readonly kind: 'outcome'; readonly outcome: CourseOutcome }
  | { readonly kind: 'exit'; readonly saved: boolean };
