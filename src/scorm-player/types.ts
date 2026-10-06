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

/** How learners may move within an activity's children (SCORM 2004 control modes). */
export interface ControlMode {
  readonly choice: boolean;
  readonly choiceExit: boolean;
  readonly flow: boolean;
  readonly forwardOnly: boolean;
}

/** One condition of a sequencing rule, optionally about one of the activity's objectives. */
export interface RuleCondition {
  readonly condition: string;
  /** The `not` operator. */
  readonly negate: boolean;
  /** The objective the condition is about; the primary objective when absent. */
  readonly objective?: string;
  readonly measureThreshold?: number;
}

/** A precondition rule: when its conditions hold, its action applies before the activity is delivered. */
export interface PreconditionRule {
  readonly combination: 'all' | 'any';
  readonly conditions: readonly RuleCondition[];
  readonly action: 'skip' | 'disabled' | 'hiddenFromChoice' | 'stopForwardTraversal';
}

/** How a local objective reads from and writes to a global (shared) objective. */
export interface ObjectiveMap {
  readonly target: string;
  readonly readSatisfied: boolean;
  readonly readMeasure: boolean;
  readonly writeSatisfied: boolean;
  readonly writeMeasure: boolean;
}

export interface ObjectiveDefinition {
  readonly id: string;
  readonly primary: boolean;
  readonly satisfiedByMeasure: boolean;
  readonly minNormalizedMeasure: number;
  readonly maps: readonly ObjectiveMap[];
}

/** The sequencing rules a course declares for one activity. */
export interface SequencingDefinition {
  readonly controlMode: ControlMode;
  /** How many attempts the learner may make on the activity; unlimited when absent. */
  readonly attemptLimit?: number;
  readonly preconditions: readonly PreconditionRule[];
  /** The activity's objectives, primary first. */
  readonly objectives: readonly ObjectiveDefinition[];
}

/** One activity in the course's organization: a launchable item or a module of child activities. */
export interface CourseNode {
  readonly id: string;
  readonly title: string;
  /** Set for a launchable item; a module has children instead. */
  readonly activity?: Activity;
  readonly children: readonly CourseNode[];
  readonly sequencing: SequencingDefinition;
}

export interface ValidatedCourse {
  readonly edition: ScormEdition;
  readonly title: string;
  /** The launchable activities in course order. */
  readonly activities: readonly Activity[];
  /** The organization as a tree; its root is the course itself. */
  readonly tree: CourseNode;
  /** The root the activity URLs are relative to. */
  readonly root: string;
  /** For a ZIP package, its validated files by path; the host serves them. An extracted course has none. */
  readonly files?: ReadonlyMap<string, Blob>;
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
  /** SCORM 2004 only: the score scaled to the range -1 to 1. */
  readonly scaled?: number;
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
