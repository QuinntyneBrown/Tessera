import { AttemptSnapshot } from '../types';
import { deriveOutcome } from './outcome-calculator';

const snapshot = (values?: Record<string, string>): AttemptSnapshot => ({
  schemaVersion: 1,
  context: { attemptKey: 'a', courseKey: 'c', courseRevision: '1' },
  edition: '1.2',
  scoStates: values ? { s: { values } } : {},
  sequencing: { currentActivityId: 's' },
});

describe('deriveOutcome for SCORM 1.2', () => {
  it('reports lesson status and score as written, leaving completion, success and progress unknown', () => {
    const outcome = deriveOutcome(
      snapshot({
        'cmi.core.lesson_status': 'passed',
        'cmi.core.score.raw': '85',
        'cmi.core.score.min': '0',
        'cmi.core.score.max': '100',
      }),
    );

    expect(outcome).toEqual({
      status: 'passed',
      completion: 'unknown',
      success: 'unknown',
      score: { raw: 85, min: 0, max: 100 },
      progress: 'unknown',
    });
  });

  it('reports the default status when only other values were written, and an unknown score', () => {
    expect(deriveOutcome(snapshot({ 'cmi.core.lesson_location': 'p1' }))).toMatchObject({
      status: 'not attempted',
      score: 'unknown',
    });
  });

  it('reports everything unknown when the current SCO has no state', () => {
    expect(deriveOutcome(snapshot())).toEqual({
      status: 'unknown',
      completion: 'unknown',
      success: 'unknown',
      score: 'unknown',
      progress: 'unknown',
    });
  });

  it('treats a blank score as unknown', () => {
    expect(deriveOutcome(snapshot({ 'cmi.core.score.raw': '' }))).toMatchObject({
      score: 'unknown',
    });
  });
});

describe('deriveOutcome for SCORM 2004', () => {
  const snapshot2004 = (values: Record<string, string>): AttemptSnapshot => ({
    ...snapshot(values),
    edition: '2004-4th',
  });

  it('reports completion and success separately, with the scaled score', () => {
    const outcome = deriveOutcome(
      snapshot2004({
        'cmi.completion_status': 'completed',
        'cmi.success_status': 'failed',
        'cmi.score.scaled': '0.4',
        'cmi.score.raw': '40',
      }),
    );

    expect(outcome).toEqual({
      status: 'unknown',
      completion: 'completed',
      success: 'failed',
      score: { scaled: 0.4, raw: 40 },
      progress: 'unknown',
    });
  });

  it('leaves every outcome unknown when the SCO has reported nothing', () => {
    expect(deriveOutcome(snapshot2004({}))).toEqual({
      status: 'unknown',
      completion: 'unknown',
      success: 'unknown',
      score: 'unknown',
      progress: 'unknown',
    });
  });
});
