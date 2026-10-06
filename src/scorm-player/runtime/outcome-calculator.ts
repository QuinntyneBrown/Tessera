import { AttemptSnapshot, CourseOutcome, Score } from '../types';

const numberOrNull = (value: string | undefined): number | null =>
  value === undefined || value === '' ? null : Number(value);

/**
 * Derives the outcome from the current SCO's accepted values. SCORM 2004 reports completion and success
 * separately and has no lesson status.
 */
export function deriveOutcome(snapshot: AttemptSnapshot): CourseOutcome {
  return snapshot.edition === '1.2' ? derive12(snapshot) : derive2004(snapshot);
}

function scoreFrom(values: Readonly<Record<string, string>>, prefix: string): Score | 'unknown' {
  const score: { -readonly [K in keyof Score]: number } = {};
  for (const part of ['scaled', 'raw', 'min', 'max'] as const) {
    const value = numberOrNull(values[`${prefix}.${part}`]);
    if (value !== null) score[part] = value;
  }
  return Object.keys(score).length > 0 ? score : 'unknown';
}

function derive2004(snapshot: AttemptSnapshot): CourseOutcome {
  const values = snapshot.scoStates[snapshot.sequencing.currentActivityId]?.values ?? {};
  return {
    status: 'unknown',
    completion: values['cmi.completion_status'] ?? 'unknown',
    success: values['cmi.success_status'] ?? 'unknown',
    score: scoreFrom(values, 'cmi.score'),
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
