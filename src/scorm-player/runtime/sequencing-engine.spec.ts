import { ControlMode, CourseNode, SequencingDefinition } from '../types';
import { SequencingEngine } from './sequencing-engine';

const FREE: ControlMode = { choice: true, choiceExit: true, flow: true, forwardOnly: false };

function rules(definition: Partial<SequencingDefinition> = {}): SequencingDefinition {
  return { controlMode: FREE, preconditions: [], objectives: [], ...definition };
}

function leaf(id: string): CourseNode {
  return {
    id,
    title: id,
    activity: { id, title: id, resource: { kind: 'sco', url: `https://course.test/${id}` } },
    children: [],
    sequencing: rules(),
  };
}

function module(id: string, children: CourseNode[], controlMode: Partial<ControlMode> = {}) {
  return {
    id,
    title: id,
    children,
    sequencing: rules({ controlMode: { ...FREE, ...controlMode } }),
  } satisfies CourseNode;
}

describe('SequencingEngine flow', () => {
  const tree = module('root', [module('m1', [leaf('a'), leaf('b')]), leaf('c')]);
  const engine = new SequencingEngine(tree);

  it('starts at the first launchable activity', () => {
    expect(engine.start()).toEqual({ kind: 'launch', id: 'a' });
  });

  it('continues to the next activity, leaving and entering modules', () => {
    expect(engine.next('a')).toEqual({ kind: 'launch', id: 'b' });
    expect(engine.next('b')).toEqual({ kind: 'launch', id: 'c' });
  });

  it('goes back to the previous activity, entering a module at its last activity', () => {
    expect(engine.previous('c')).toEqual({ kind: 'launch', id: 'b' });
    expect(engine.previous('b')).toEqual({ kind: 'launch', id: 'a' });
  });

  it('denies moving past either end of the course', () => {
    expect(engine.previous('a')).toEqual({ kind: 'denied', reason: 'This is the first activity.' });
    expect(engine.next('c')).toEqual({ kind: 'denied', reason: 'This is the last activity.' });
  });

  it('denies Next and Previous inside a module that does not allow flow', () => {
    const noFlow = new SequencingEngine(
      module('root', [module('m1', [leaf('a'), leaf('b')], { flow: false })]),
    );

    expect(noFlow.next('a')).toEqual({
      kind: 'denied',
      reason: 'Choose the next activity from the course outline.',
    });
  });

  it('starts a course whose root does not allow flow at the first activity the learner may choose', () => {
    const noFlow = new SequencingEngine(
      module('root', [module('m1', [leaf('a')], { choice: false }), leaf('b')], { flow: false }),
    );

    expect(noFlow.start()).toEqual({ kind: 'launch', id: 'b' });
  });
});

describe('SequencingEngine choice', () => {
  it('allows choosing any activity when every module allows choice', () => {
    const engine = new SequencingEngine(module('root', [module('m1', [leaf('a')]), leaf('b')]));

    expect(engine.choose('a', 'b')).toEqual({ kind: 'launch', id: 'b' });
    expect(engine.unavailableReason('a', 'b')).toBeNull();
  });

  it('denies choosing an activity whose module disallows choice, giving the reason', () => {
    const engine = new SequencingEngine(
      module('root', [module('m1', [leaf('a'), leaf('b')], { choice: false }), leaf('c')]),
    );
    const reason = 'Take this course in order using Next.';

    expect(engine.choose('a', 'b')).toEqual({ kind: 'denied', reason });
    expect(engine.unavailableReason('a', 'c')).toBeNull();
  });
});

describe('SequencingEngine SCO navigation requests', () => {
  const engine = new SequencingEngine(
    module('root', [module('m1', [leaf('a'), leaf('b')], { choice: false }), leaf('c')]),
  );

  it.each([
    ['continue', { kind: 'launch', id: 'b' }],
    ['previous', { kind: 'denied', reason: 'This is the first activity.' }],
    ['{target=c}choice', { kind: 'launch', id: 'c' }],
    ['{target=b}choice', { kind: 'denied', reason: 'Take this course in order using Next.' }],
    ['{target=b}jump', { kind: 'launch', id: 'b' }],
    ['exit', { kind: 'exit' }],
    ['abandon', { kind: 'exit' }],
    ['exitAll', { kind: 'end', suspended: false }],
    ['abandonAll', { kind: 'end', suspended: false }],
    ['suspendAll', { kind: 'end', suspended: true }],
  ])('from the first activity, %s gives %j', (request, decision) => {
    expect(engine.request('a', request)).toEqual(decision);
  });

  it('ignores _none_ and requests for activities the course does not have', () => {
    expect(engine.request('a', '_none_')).toBeNull();
    expect(engine.request('a', '{target=zzz}choice')).toBeNull();
  });
});

describe('SequencingEngine attempt limits', () => {
  const limited = (id: string, attemptLimit: number): CourseNode => ({
    ...leaf(id),
    sequencing: rules({ attemptLimit }),
  });
  const tree = module('root', [limited('a', 1), leaf('b')]);
  const reason = 'You have used every attempt at this activity.';

  it('counts an attempt on each delivery, and on each module newly entered', () => {
    const nested = module('root', [module('m', [leaf('a'), leaf('b')])]);
    const once = new SequencingEngine(nested).delivered(null, 'a');
    const twice = new SequencingEngine(nested, once).delivered('a', 'b');

    expect(once.activities).toEqual({
      root: { attempts: 1 },
      m: { attempts: 1 },
      a: { attempts: 1 },
    });
    expect(twice.activities).toEqual({
      root: { attempts: 1 },
      m: { attempts: 1 },
      a: { attempts: 1 },
      b: { attempts: 1 },
    });
  });

  it('allows an activity until its limit is used, then denies choice and flow into it', () => {
    const fresh = new SequencingEngine(tree);
    expect(fresh.unavailableReason('b', 'a')).toBeNull();

    const used = new SequencingEngine(tree, fresh.delivered(null, 'a'));

    expect(used.unavailableReason('b', 'a')).toBe(reason);
    expect(used.previous('b')).toEqual({ kind: 'denied', reason });
  });
});

describe('SequencingEngine preconditions and objectives', () => {
  const withRules = (id: string, definition: Partial<SequencingDefinition>): CourseNode => ({
    ...leaf(id),
    sequencing: rules(definition),
  });
  const lesson = withRules('lesson', {
    objectives: [
      {
        id: 'lesson-passed',
        primary: true,
        satisfiedByMeasure: false,
        minNormalizedMeasure: 1,
        maps: [
          {
            target: 'g',
            readSatisfied: true,
            readMeasure: true,
            writeSatisfied: true,
            writeMeasure: false,
          },
        ],
      },
    ],
  });
  const quiz = withRules('quiz', {
    preconditions: [
      {
        combination: 'all',
        conditions: [{ condition: 'satisfied', negate: true, objective: 'prerequisite' }],
        action: 'disabled',
      },
    ],
    objectives: [
      { id: 'quiz', primary: true, satisfiedByMeasure: false, minNormalizedMeasure: 1, maps: [] },
      {
        id: 'prerequisite',
        primary: false,
        satisfiedByMeasure: false,
        minNormalizedMeasure: 1,
        maps: [
          {
            target: 'g',
            readSatisfied: true,
            readMeasure: true,
            writeSatisfied: false,
            writeMeasure: false,
          },
        ],
      },
    ],
  });
  const tree = module('root', [lesson, quiz]);
  const locked = 'This activity is locked until its prerequisites are met.';

  it('leaves a rule about an unknown objective unapplied, since not(unknown) is unknown', () => {
    const engine = new SequencingEngine(tree);

    expect(engine.unavailableReason('lesson', 'quiz')).toBeNull();
  });

  it('applies a disabled rule once the objective it reads through a global is known to be unmet', () => {
    const failed = new SequencingEngine(tree).reported('lesson', {
      'cmi.success_status': 'failed',
    });
    const engine = new SequencingEngine(tree, failed);

    expect(failed.globals).toEqual({ g: { satisfied: false } });
    expect(engine.unavailableReason('lesson', 'quiz')).toBe(locked);
    expect(engine.next('lesson')).toEqual({ kind: 'denied', reason: locked });
  });

  it('lifts the rule when the SCO reports the objective satisfied', () => {
    const passed = new SequencingEngine(tree).reported('lesson', {
      'cmi.success_status': 'passed',
    });

    expect(new SequencingEngine(tree, passed).next('lesson')).toEqual({
      kind: 'launch',
      id: 'quiz',
    });
  });

  it('skips an activity whose skip rule holds when flowing past it', () => {
    const skipped = withRules('b', {
      preconditions: [
        {
          combination: 'all',
          conditions: [{ condition: 'always', negate: false }],
          action: 'skip',
        },
      ],
    });
    const engine = new SequencingEngine(module('root', [leaf('a'), skipped, leaf('c')]));

    expect(engine.next('a')).toEqual({ kind: 'launch', id: 'c' });
    expect(engine.previous('c')).toEqual({ kind: 'launch', id: 'a' });
  });

  it('hides an activity whose hiddenFromChoice rule holds and refuses to choose it', () => {
    const hiddenOne = withRules('b', {
      preconditions: [
        {
          combination: 'any',
          conditions: [{ condition: 'attempted', negate: true }],
          action: 'hiddenFromChoice',
        },
      ],
    });
    const engine = new SequencingEngine(module('root', [leaf('a'), hiddenOne]));

    expect(engine.hidden('b')).toBe(true);
    expect(engine.choose('a', 'b').kind).toBe('denied');
  });

  it('derives satisfaction from the scaled score when the objective is satisfied by measure', () => {
    const byMeasure = withRules('a', {
      objectives: [
        {
          id: 'a',
          primary: true,
          satisfiedByMeasure: true,
          minNormalizedMeasure: 0.8,
          maps: [
            {
              target: 'g',
              readSatisfied: true,
              readMeasure: true,
              writeSatisfied: true,
              writeMeasure: true,
            },
          ],
        },
      ],
    });
    const engine = new SequencingEngine(module('root', [byMeasure]));

    expect(engine.reported('a', { 'cmi.score.scaled': '0.7' }).globals).toEqual({
      g: { satisfied: false, measure: 0.7 },
    });
  });

  it('records a non-primary objective that the SCO reports through cmi.objectives', () => {
    const tracking = new SequencingEngine(tree).reported('quiz', {
      'cmi.objectives.0.id': 'prerequisite',
      'cmi.objectives.0.success_status': 'passed',
      'cmi.completion_status': 'completed',
    });

    expect(tracking.activities['quiz']).toEqual({
      attempts: 0,
      completion: 'completed',
      objectives: { quiz: {}, prerequisite: { satisfied: true } },
    });
  });
});
