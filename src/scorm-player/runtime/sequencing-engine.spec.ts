import { ControlMode, CourseNode } from '../types';
import { SequencingEngine } from './sequencing-engine';

const FREE: ControlMode = { choice: true, choiceExit: true, flow: true, forwardOnly: false };

function leaf(id: string): CourseNode {
  return {
    id,
    title: id,
    activity: { id, title: id, resource: { kind: 'sco', url: `https://course.test/${id}` } },
    children: [],
    sequencing: { controlMode: FREE },
  };
}

function module(id: string, children: CourseNode[], controlMode: Partial<ControlMode> = {}) {
  return {
    id,
    title: id,
    children,
    sequencing: { controlMode: { ...FREE, ...controlMode } },
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
