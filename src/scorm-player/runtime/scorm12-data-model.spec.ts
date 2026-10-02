import { RuntimeSession } from './runtime-session';

function running(): RuntimeSession {
  const session = new RuntimeSession();
  session.initialize('');
  return session;
}

function write(session: RuntimeSession, element: string, value: string): [string, string] {
  return [session.setValue(element, value), session.lastError];
}

describe('SCORM 1.2 data model', () => {
  it('returns the specified initial values', () => {
    const session = running();

    expect(session.getValue('cmi._version')).toBe('3.4');
    expect(session.getValue('cmi.core.lesson_status')).toBe('not attempted');
    expect(session.getValue('cmi.core.entry')).toBe('ab-initio');
    expect(session.getValue('cmi.core.credit')).toBe('credit');
    expect(session.getValue('cmi.core.lesson_mode')).toBe('normal');
    expect(session.getValue('cmi.core.total_time')).toBe('0000:00:00');
    expect(session.getValue('cmi.core.score._children')).toBe('raw,min,max');
    expect(session.getValue('cmi.core.lesson_location')).toBe('');
  });

  it('reads back a valid value in the form it was written', () => {
    const session = running();

    expect(write(session, 'cmi.core.lesson_status', 'incomplete')).toEqual(['true', '0']);
    expect(session.getValue('cmi.core.lesson_status')).toBe('incomplete');
    expect(write(session, 'cmi.core.score.raw', '85.5')).toEqual(['true', '0']);
    expect(session.getValue('cmi.core.score.raw')).toBe('85.5');
  });

  it.each([
    'cmi._version',
    'cmi.core.student_id',
    'cmi.core.credit',
    'cmi.core.total_time',
    'cmi.launch_data',
  ])('refuses to write read-only %s with error 403', (element) => {
    expect(write(running(), element, 'x')).toEqual(['false', '403']);
  });

  it.each(['cmi.core.exit', 'cmi.core.session_time'])(
    'refuses to read write-only %s with error 404',
    (element) => {
      const session = running();

      expect(session.getValue(element)).toBe('');
      expect(session.lastError).toBe('404');
    },
  );

  it.each([
    ['cmi.core.lesson_status', 'finished'],
    ['cmi.core.score.raw', '101'],
    ['cmi.core.score.raw', '-1'],
    ['cmi.core.score.raw', 'high'],
    ['cmi.core.exit', 'quit'],
    ['cmi.core.session_time', '1:2:3'],
    ['cmi.core.session_time', '0000:60:00'],
    ['cmi.suspend_data', 'x'.repeat(4097)],
    ['cmi.core.lesson_location', 'x'.repeat(256)],
    ['cmi.student_preference.audio', '101'],
    ['cmi.student_preference.text', '2'],
  ])('rejects %s = %j with error 405 and keeps the previous value', (element, value) => {
    const session = running();
    const readable = element !== 'cmi.core.exit' && element !== 'cmi.core.session_time';
    const before = readable ? session.getValue(element) : '';

    expect(write(session, element, value)).toEqual(['false', '405']);
    if (readable) expect(session.getValue(element)).toBe(before);
  });

  it('accepts suspend data up to 4096 characters', () => {
    const session = running();
    const full = 'x'.repeat(4096);

    expect(write(session, 'cmi.suspend_data', full)).toEqual(['true', '0']);
    expect(session.getValue('cmi.suspend_data')).toBe(full);
  });

  it('accepts a blank score and valid timespans', () => {
    const session = running();

    expect(write(session, 'cmi.core.score.raw', '')).toEqual(['true', '0']);
    expect(write(session, 'cmi.core.session_time', '0001:30:15.50')).toEqual(['true', '0']);
  });

  it('treats _children and _count as keywords that cannot be set (402)', () => {
    const session = running();

    expect(write(session, 'cmi.core._children', 'x')).toEqual(['false', '402']);
    expect(write(session, 'cmi.objectives._count', '1')).toEqual(['false', '402']);
  });

  it('reports 202 for _children of a leaf and 203 for _count of a non-array', () => {
    const session = running();

    expect(session.getValue('cmi.core.lesson_location._children')).toBe('');
    expect(session.lastError).toBe('202');
    expect(session.getValue('cmi.core.lesson_location._count')).toBe('');
    expect(session.lastError).toBe('203');
  });

  it('grows arrays sequentially and counts their entries', () => {
    const session = running();

    expect(session.getValue('cmi.objectives._count')).toBe('0');
    expect(write(session, 'cmi.objectives.0.id', 'obj-a')).toEqual(['true', '0']);
    expect(write(session, 'cmi.objectives.1.id', 'obj-b')).toEqual(['true', '0']);
    expect(session.getValue('cmi.objectives._count')).toBe('2');
    expect(session.getValue('cmi.objectives.1.id')).toBe('obj-b');
  });

  it('rejects an array index that skips ahead (201) or reads past the end (201)', () => {
    const session = running();

    expect(write(session, 'cmi.objectives.2.id', 'obj-c')).toEqual(['false', '201']);
    expect(session.getValue('cmi.objectives.0.id')).toBe('');
    expect(session.lastError).toBe('201');
  });

  it('supports write-only interaction elements and their counts', () => {
    const session = running();

    expect(write(session, 'cmi.interactions.0.id', 'q1')).toEqual(['true', '0']);
    expect(write(session, 'cmi.interactions.0.type', 'choice')).toEqual(['true', '0']);
    expect(write(session, 'cmi.interactions.0.result', 'correct')).toEqual(['true', '0']);
    expect(write(session, 'cmi.interactions.0.objectives.0.id', 'obj-a')).toEqual(['true', '0']);
    expect(session.getValue('cmi.interactions._count')).toBe('1');
    expect(session.getValue('cmi.interactions.0.objectives._count')).toBe('1');
    expect(session.getValue('cmi.interactions.0.id')).toBe('');
    expect(session.lastError).toBe('404');
  });
});

describe('SCORM 1.2 session restore', () => {
  it('restores saved values, sets entry to resume after a suspend exit, and counts restored arrays', () => {
    const session = new RuntimeSession();
    session.restore({
      'cmi.core.lesson_location': 'page 8',
      'cmi.objectives.0.id': 'obj-a',
      'cmi.core.exit': 'suspend',
    });
    session.initialize('');

    expect(session.getValue('cmi.core.lesson_location')).toBe('page 8');
    expect(session.getValue('cmi.core.entry')).toBe('resume');
    expect(session.getValue('cmi.objectives._count')).toBe('1');
    expect(session.values()).not.toHaveProperty('cmi.core.exit');
  });

  it('leaves entry empty when the previous exit was not a suspend', () => {
    const session = new RuntimeSession();
    session.restore({ 'cmi.core.lesson_location': 'page 8', 'cmi.core.exit': 'logout' });
    session.initialize('');

    expect(session.getValue('cmi.core.entry')).toBe('');
  });

  it('reports ab-initio for a session with nothing restored', () => {
    const session = new RuntimeSession();
    session.initialize('');

    expect(session.getValue('cmi.core.entry')).toBe('ab-initio');
  });
});
