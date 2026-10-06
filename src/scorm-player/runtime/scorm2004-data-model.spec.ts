import { ScormEdition } from '../types';
import { Scorm2004Session } from './scorm2004-session';

function running(edition: ScormEdition = '2004-4th'): Scorm2004Session {
  const session = new Scorm2004Session(edition);
  session.initialize('');
  return session;
}

function write(session: Scorm2004Session, element: string, value: string): [string, string] {
  return [session.setValue(element, value), session.lastError];
}

function read(session: Scorm2004Session, element: string): [string, string] {
  return [session.getValue(element), session.lastError];
}

describe('SCORM 2004 data model', () => {
  it('returns the specified initial values', () => {
    const session = running();

    expect(read(session, 'cmi._version')).toEqual(['1.0', '0']);
    expect(read(session, 'cmi.completion_status')).toEqual(['unknown', '0']);
    expect(read(session, 'cmi.success_status')).toEqual(['unknown', '0']);
    expect(read(session, 'cmi.entry')).toEqual(['ab-initio', '0']);
    expect(read(session, 'cmi.credit')).toEqual(['credit', '0']);
    expect(read(session, 'cmi.mode')).toEqual(['normal', '0']);
    expect(read(session, 'cmi.total_time')).toEqual(['PT0H0M0S', '0']);
    expect(read(session, 'cmi.learner_preference.audio_level')).toEqual(['1', '0']);
    expect(read(session, 'cmi.learner_preference.audio_captioning')).toEqual(['0', '0']);
    expect(read(session, 'cmi.score._children')).toEqual(['scaled,raw,min,max', '0']);
    expect(read(session, 'cmi.objectives._count')).toEqual(['0', '0']);
    expect(read(session, 'adl.nav.request')).toEqual(['_none_', '0']);
  });

  it.each([
    'cmi.location',
    'cmi.suspend_data',
    'cmi.score.raw',
    'cmi.progress_measure',
    'cmi.launch_data',
    'cmi.scaled_passing_score',
    'cmi.completion_threshold',
    'cmi.max_time_allowed',
  ])('reports 403 when %s has no value yet', (element) => {
    expect(read(running(), element)).toEqual(['', '403']);
  });

  it('reads back valid values in the form they were written', () => {
    const session = running();

    for (const [element, value] of [
      ['cmi.location', 'page 4'],
      ['cmi.completion_status', 'incomplete'],
      ['cmi.success_status', 'passed'],
      ['cmi.score.scaled', '-0.25'],
      ['cmi.score.raw', '85.5'],
      ['cmi.progress_measure', '0.4'],
      ['cmi.exit', 'suspend'],
      ['cmi.session_time', 'PT1H30M5.25S'],
      ['cmi.learner_preference.language', 'en-GB'],
      ['cmi.learner_preference.delivery_speed', '1.5'],
      ['cmi.comments_from_learner.0.comment', '{lang=en}Good course'],
      ['cmi.comments_from_learner.0.timestamp', '2026-10-06T09:15:30.5Z'],
    ]) {
      expect(write(session, element, value)).toEqual(['true', '0']);
      if (element !== 'cmi.exit' && element !== 'cmi.session_time') {
        expect(session.getValue(element)).toBe(value);
      }
    }
  });

  it.each(['cmi._version', 'cmi.credit', 'cmi.entry', 'cmi.total_time', 'cmi.learner_id'])(
    'refuses to write read-only %s with error 404',
    (element) => {
      expect(write(running(), element, 'x')).toEqual(['false', '404']);
    },
  );

  it.each(['cmi.score._children', 'cmi.objectives._count'])(
    'refuses to write keyword %s with error 404',
    (element) => {
      expect(write(running(), element, '1')).toEqual(['false', '404']);
    },
  );

  it.each(['cmi.exit', 'cmi.session_time'])(
    'refuses to read write-only %s with error 405',
    (element) => {
      expect(read(running(), element)).toEqual(['', '405']);
    },
  );

  it('reports 401 for an element the data model does not define', () => {
    const session = running();

    expect(read(session, 'cmi.core.lesson_status')).toEqual(['', '401']);
    expect(write(session, 'cmi.bogus', 'x')).toEqual(['false', '401']);
  });

  it('reports 301 for _children or _count on an element that has none', () => {
    const session = running();

    expect(read(session, 'cmi.location._children')).toEqual(['', '301']);
    expect(read(session, 'cmi.location._count')).toEqual(['', '301']);
  });

  it.each([
    ['cmi.completion_status', 'finished', '406'],
    ['cmi.success_status', 'complete', '406'],
    ['cmi.exit', 'quit', '406'],
    ['cmi.score.raw', 'eighty', '406'],
    ['cmi.session_time', '01:30:00', '406'],
    ['cmi.session_time', 'PT', '406'],
    ['cmi.comments_from_learner.0.timestamp', '06/10/2026', '406'],
    ['cmi.learner_preference.language', 'not a language', '406'],
    ['cmi.learner_preference.audio_captioning', '2', '406'],
    ['cmi.score.scaled', '1.0001', '407'],
    ['cmi.score.scaled', '-2', '407'],
    ['cmi.progress_measure', '1.5', '407'],
    ['cmi.learner_preference.audio_level', '-1', '407'],
    ['cmi.location', 'x'.repeat(1001), '407'],
  ])('rejects %s = %s with error %s', (element, value, code) => {
    expect(write(running(), element, value)).toEqual(['false', code]);
  });

  it('keeps the previous valid value when a write is rejected', () => {
    const session = running();
    write(session, 'cmi.score.scaled', '0.5');

    write(session, 'cmi.score.scaled', '3');

    expect(session.getValue('cmi.score.scaled')).toBe('0.5');
  });

  describe('collections', () => {
    it('adds entries one at a time and counts them', () => {
      const session = running();

      expect(write(session, 'cmi.objectives.1.id', 'urn:o:2')).toEqual(['false', '351']);
      expect(write(session, 'cmi.objectives.0.id', 'urn:o:1')).toEqual(['true', '0']);
      expect(write(session, 'cmi.objectives.1.id', 'urn:o:2')).toEqual(['true', '0']);
      expect(read(session, 'cmi.objectives._count')).toEqual(['2', '0']);
      expect(read(session, 'cmi.objectives.1.id')).toEqual(['urn:o:2', '0']);
      expect(read(session, 'cmi.objectives.0.success_status')).toEqual(['unknown', '0']);
      expect(read(session, 'cmi.objectives.0.score.raw')).toEqual(['', '403']);
    });

    it('reports 301 when reading an entry that does not exist', () => {
      expect(read(running(), 'cmi.objectives.0.id')).toEqual(['', '301']);
    });

    it('requires an objective identifier before any other objective value', () => {
      const session = running();

      expect(write(session, 'cmi.objectives.0.success_status', 'passed')).toEqual(['false', '408']);
    });

    it('refuses an objective identifier already used by another objective', () => {
      const session = running();
      write(session, 'cmi.objectives.0.id', 'urn:o:1');

      expect(write(session, 'cmi.objectives.1.id', 'urn:o:1')).toEqual(['false', '351']);
    });

    it('requires an interaction identifier and type before its responses', () => {
      const session = running();

      expect(write(session, 'cmi.interactions.0.type', 'choice')).toEqual(['false', '408']);
      expect(write(session, 'cmi.interactions.0.id', 'urn:q:1')).toEqual(['true', '0']);
      expect(write(session, 'cmi.interactions.0.learner_response', 'a')).toEqual(['false', '408']);
      expect(write(session, 'cmi.interactions.0.type', 'choice')).toEqual(['true', '0']);
      expect(write(session, 'cmi.interactions.0.learner_response', 'a[,]b')).toEqual(['true', '0']);
      expect(write(session, 'cmi.interactions.0.correct_responses.0.pattern', 'b')).toEqual([
        'true',
        '0',
      ]);
      expect(read(session, 'cmi.interactions.0.correct_responses._count')).toEqual(['1', '0']);
    });

    it.each([
      ['true-false', 'true', 'yes'],
      ['choice', 'a[,]b', 'a[,]a'],
      ['numeric', '3.5', 'three'],
      ['likert', 'agree', 'strongly agree'],
    ])('checks a %s learner response against its type', (type, valid, invalid) => {
      const session = running();
      write(session, 'cmi.interactions.0.id', 'urn:q:1');
      write(session, 'cmi.interactions.0.type', type);

      expect(write(session, 'cmi.interactions.0.learner_response', valid)).toEqual(['true', '0']);
      expect(write(session, 'cmi.interactions.0.learner_response', invalid)).toEqual([
        'false',
        '406',
      ]);
    });

    it('accepts a result vocabulary word or a number', () => {
      const session = running();
      write(session, 'cmi.interactions.0.id', 'urn:q:1');

      expect(write(session, 'cmi.interactions.0.result', 'incorrect')).toEqual(['true', '0']);
      expect(write(session, 'cmi.interactions.0.result', '0.75')).toEqual(['true', '0']);
      expect(write(session, 'cmi.interactions.0.result', 'wrong')).toEqual(['false', '406']);
    });
  });

  describe('edition differences', () => {
    it.each([
      ['2004-2nd', 'false'],
      ['2004-3rd', 'false'],
      ['2004-4th', 'true'],
    ] as const)('in %s, suspend data of 4,001 characters is accepted: %s', (edition, result) => {
      expect(running(edition).setValue('cmi.suspend_data', 'x'.repeat(4001))).toBe(result);
    });

    it.each([
      ['2004-2nd', ['', '401']],
      ['2004-3rd', ['', '401']],
      ['2004-4th', ['0', '0']],
    ] as const)('in %s, shared data (adl.data) reads as %j', (edition, expected) => {
      expect(read(running(edition), 'adl.data._count')).toEqual(expected);
    });

    it.each([
      ['2004-3rd', ['false', '406']],
      ['2004-4th', ['true', '0']],
    ] as const)('in %s, a jump navigation request is %j', (edition, expected) => {
      expect(write(running(edition), 'adl.nav.request', '{target=item2}jump')).toEqual(expected);
    });
  });

  it('accepts the navigation request vocabulary', () => {
    const session = running('2004-3rd');

    for (const request of ['continue', 'previous', '{target=item2}choice', 'exitAll', '_none_']) {
      expect(write(session, 'adl.nav.request', request)).toEqual(['true', '0']);
    }
    expect(read(session, 'adl.nav.request')).toEqual(['_none_', '0']);
  });

  describe('resume', () => {
    it('restores saved values and reports resume entry after a suspended exit', () => {
      const session = new Scorm2004Session('2004-4th');
      session.restore({ 'cmi.location': 'page 8', 'cmi.exit': 'suspend' });
      session.initialize('');

      expect(read(session, 'cmi.location')).toEqual(['page 8', '0']);
      expect(read(session, 'cmi.entry')).toEqual(['resume', '0']);
    });

    it('reports a fresh entry when the saved exit was not a suspension', () => {
      const session = new Scorm2004Session('2004-4th');
      session.restore({ 'cmi.location': 'page 8', 'cmi.exit': 'normal' });
      session.initialize('');

      expect(read(session, 'cmi.entry')).toEqual(['', '0']);
    });
  });
});
