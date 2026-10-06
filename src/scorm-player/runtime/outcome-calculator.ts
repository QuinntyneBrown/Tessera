import { AttemptSnapshot, CourseNode, CourseOutcome, Score } from '../types';
import { NO_TRACKING, SequencingEngine } from './sequencing-engine';

const numberOrNull = (value: string | undefined): number | null =>
  value === undefined || value === '' ? null : Number(value);

/**
 * Derives the course outcome. SCORM 1.2 reports the current SCO's lesson status and score; SCORM 2004
 * reports the course's rolled-up completion, success and measure separately, and has no lesson status.
 */
export function deriveOutcome(snapshot: AttemptSnapshot, course: CourseNode): CourseOutcome {
  return snapshot.edition === '1.2' ? derive12(snapshot) : derive2004(snapshot, course);
}

function scoreFrom(values: Readonly<Record<string, string>>, prefix: string): Score | 'unknown' {
  const score: { -readonly [K in keyof Score]: number } = {};
  for (const part of ['scaled', 'raw', 'min', 'max'] as const) {
    const value = numberOrNull(values[`${prefix}.${part}`]);
    if (value !== null) score[part] = value;
  }
  return Object.keys(score).length > 0 ? score : 'unknown';
}

function derive2004(snapshot: AttemptSnapshot, course: CourseNode): CourseOutcome {
  const tracking = snapshot.sequencing.tracking ?? NO_TRACKING;
  const { completion, satisfied, measure } = new SequencingEngine(course, tracking).status(
    course.id,
  );
  return {
    status: 'unknown',
    completion: completion ?? 'unknown',
    success: satisfied === undefined ? 'unknown' : satisfied ? 'passed' : 'failed',
    score: measure === undefined ? 'unknown' : { scaled: measure },
    progress: 'unknown',
  };
}

/**
 * Derives the SCORM 1.2 outcome from the current SCO's accepted values. SCORM 1.2 has no course
 * rollup, so completion, success and progress stay unknown rather than being inferred.
 */
function derive12(snapshot: AttemptSnapshot): CourseOutcome {
  const unknown = { completion: 'unknown', success: 'unknown', progress: 'unknown' } as const;
  const state = snapshot.scoStates[snapshot.sequencing.currentActivityId];
  if (!state) return { status: 'unknown', score: 'unknown', ...unknown };

  const { values } = state;
  return {
    status: values['cmi.core.lesson_status'] ?? 'not attempted',
    score: scoreFrom(values, 'cmi.core.score'),
    ...unknown,
  };
}
