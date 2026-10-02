import { AttemptSnapshot, CourseOutcome, Score } from '../types';

const numberOrNull = (value: string | undefined): number | null =>
  value === undefined || value === '' ? null : Number(value);

/**
 * Derives the SCORM 1.2 outcome from the current SCO's accepted values. SCORM 1.2 has no course
 * rollup, so completion, success and progress stay unknown rather than being inferred.
 */
export function deriveOutcome(snapshot: AttemptSnapshot): CourseOutcome {
  const unknown = { completion: 'unknown', success: 'unknown', progress: 'unknown' } as const;
  const state = snapshot.scoStates[snapshot.sequencing.currentActivityId];
  if (!state) return { status: 'unknown', score: 'unknown', ...unknown };

  const { values } = state;
  const score: { -readonly [K in keyof Score]: number } = {};
  for (const part of ['raw', 'min', 'max'] as const) {
    const value = numberOrNull(values[`cmi.core.score.${part}`]);
    if (value !== null) score[part] = value;
  }
  return {
    status: values['cmi.core.lesson_status'] ?? 'not attempted',
    score: Object.keys(score).length > 0 ? score : 'unknown',
    ...unknown,
  };
}
