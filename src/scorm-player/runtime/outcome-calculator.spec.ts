import { ActivityTracking, AttemptSnapshot, CourseNode } from '../types';
import { deriveOutcome } from './outcome-calculator';

const sequencing = {
  controlMode: { choice: true, choiceExit: true, flow: true, forwardOnly: false },
  preconditions: [],
  objectives: [],
  rollup: {
    rules: [],
    objectiveSatisfied: true,
    progressCompletion: true,
    objectiveMeasureWeight: 1,
  },
};
const sco = (id: string): CourseNode => ({
  id,
  title: id,
  activity: { id, title: id, resource: { kind: 'sco', url: `https://course.test/${id}` } },
  children: [],
  sequencing,
});
const course: CourseNode = { id: 'root', title: 'Course', children: [sco('s')], sequencing };

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
      course,
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
    expect(deriveOutcome(snapshot({ 'cmi.core.lesson_location': 'p1' }), course)).toMatchObject({
      status: 'not attempted',
      score: 'unknown',
    });
  });

  it('reports everything unknown when the current SCO has no state', () => {
    expect(deriveOutcome(snapshot(), course)).toEqual({
      status: 'unknown',
      completion: 'unknown',
      success: 'unknown',
      score: 'unknown',
      progress: 'unknown',
    });
  });

  it('treats a blank score as unknown', () => {
    expect(deriveOutcome(snapshot({ 'cmi.core.score.raw': '' }), course)).toMatchObject({
      score: 'unknown',
    });
  });
});

describe('deriveOutcome for SCORM 2004', () => {
  const twoScos: CourseNode = { ...course, children: [sco('a'), sco('b')] };
  const snapshot2004 = (activities: Record<string, ActivityTracking>): AttemptSnapshot => ({
    ...snapshot(),
    edition: '2004-4th',
    sequencing: { currentActivityId: 'a', tracking: { activities } },
  });

  it('reports the course rollup: completion and success separately, with the measure as scaled score', () => {
    const outcome = deriveOutcome(
      snapshot2004({
        a: {
          attempts: 1,
          completion: 'completed',
          objectives: { '': { satisfied: true, measure: 0.9 } },
        },
        b: {
          attempts: 1,
          completion: 'completed',
          objectives: { '': { satisfied: false, measure: 0.3 } },
        },
      }),
      twoScos,
    );

    expect(outcome).toEqual({
      status: 'unknown',
      completion: 'completed',
      success: 'failed',
      score: { scaled: 0.6 },
      progress: 'unknown',
    });
  });

  it('leaves the outcome unknown while a contributing SCO has reported nothing', () => {
    expect(
      deriveOutcome(
        snapshot2004({
          a: { attempts: 1, completion: 'completed', objectives: { '': { satisfied: true } } },
        }),
        twoScos,
      ),
    ).toEqual({
      status: 'unknown',
      completion: 'unknown',
      success: 'unknown',
      score: 'unknown',
      progress: 'unknown',
    });
  });
});
