/** SCORM 1.2 run-time data model: element catalog, access rules and value validation. */

export interface ElementRule {
  readonly access: 'r' | 'w' | 'rw';
  readonly initial?: string;
  readonly valid?: (value: string) => boolean;
}

const STATUS = ['passed', 'completed', 'failed', 'incomplete', 'browsed', 'not attempted'];

const string255 = (value: string) => value.length <= 255;
const string4096 = (value: string) => value.length <= 4096;
const identifier = (value: string) => /^[A-Za-z0-9_-]{1,255}$/.test(value);
const oneOf =
  (...allowed: string[]) =>
  (value: string) =>
    allowed.includes(value);
const integer = (min: number, max: number) => (value: string) =>
  /^-?\d+$/.test(value) && Number(value) >= min && Number(value) <= max;
const decimal = (value: string) => /^-?\d+(\.\d+)?$/.test(value);
const score = (value: string) =>
  value === '' || (decimal(value) && Number(value) >= 0 && Number(value) <= 100);
const timespan = (value: string) => {
  const match = /^(\d{2,4}):(\d{2}):(\d{2})(\.\d{1,2})?$/.exec(value);
  return !!match && Number(match[2]) < 60 && Number(match[3]) < 60;
};
const time = (value: string) => {
  const match = /^(\d{2}):(\d{2}):(\d{2})(\.\d{1,2})?$/.exec(value);
  return !!match && Number(match[1]) < 24 && Number(match[2]) < 60 && Number(match[3]) < 60;
};

const read = (initial: string): ElementRule => ({ access: 'r', initial });
const write = (valid: (value: string) => boolean): ElementRule => ({ access: 'w', valid });
const readWrite = (valid: (value: string) => boolean, initial = ''): ElementRule => ({
  access: 'rw',
  initial,
  valid,
});

/** Element rules keyed by normalized name: the first array index is `n`, the second is `m`. */
const CATALOG: Readonly<Record<string, ElementRule>> = {
  'cmi._version': read('3.4'),
  'cmi.core._children': read(
    'student_id,student_name,lesson_location,credit,lesson_status,entry,score,total_time,lesson_mode,exit,session_time',
  ),
  'cmi.core.student_id': read(''),
  'cmi.core.student_name': read(''),
  'cmi.core.lesson_location': readWrite(string255),
  'cmi.core.credit': read('credit'),
  'cmi.core.lesson_status': readWrite(oneOf(...STATUS), 'not attempted'),
  'cmi.core.entry': read('ab-initio'),
  'cmi.core.score._children': read('raw,min,max'),
  'cmi.core.score.raw': readWrite(score),
  'cmi.core.score.max': readWrite(score),
  'cmi.core.score.min': readWrite(score),
  'cmi.core.total_time': read('0000:00:00'),
  'cmi.core.lesson_mode': read('normal'),
  'cmi.core.exit': write(oneOf('time-out', 'suspend', 'logout', '')),
  'cmi.core.session_time': write(timespan),
  'cmi.suspend_data': readWrite(string4096),
  'cmi.launch_data': read(''),
  'cmi.comments': readWrite(string4096),
  'cmi.comments_from_lms': read(''),
  'cmi.objectives._children': read('id,score,status'),
  'cmi.objectives.n.id': readWrite(identifier),
  'cmi.objectives.n.score._children': read('raw,min,max'),
  'cmi.objectives.n.score.raw': readWrite(score),
  'cmi.objectives.n.score.max': readWrite(score),
  'cmi.objectives.n.score.min': readWrite(score),
  'cmi.objectives.n.status': readWrite(oneOf(...STATUS)),
  'cmi.student_data._children': read('mastery_score,max_time_allowed,time_limit_action'),
  'cmi.student_data.mastery_score': read(''),
  'cmi.student_data.max_time_allowed': read(''),
  'cmi.student_data.time_limit_action': read(''),
  'cmi.student_preference._children': read('audio,language,speed,text'),
  'cmi.student_preference.audio': readWrite(integer(-1, 100)),
  'cmi.student_preference.language': readWrite(string255),
  'cmi.student_preference.speed': readWrite(integer(-100, 100)),
  'cmi.student_preference.text': readWrite(integer(-1, 1)),
  'cmi.interactions._children': read(
    'id,objectives,time,type,correct_responses,weighting,student_response,result,latency',
  ),
  'cmi.interactions.n.id': write(identifier),
  'cmi.interactions.n.objectives.m.id': write(identifier),
  'cmi.interactions.n.time': write(time),
  'cmi.interactions.n.type': write(
    oneOf(
      'true-false',
      'choice',
      'fill-in',
      'matching',
      'performance',
      'sequencing',
      'likert',
      'numeric',
    ),
  ),
  'cmi.interactions.n.correct_responses.m.pattern': write(string255),
  'cmi.interactions.n.weighting': write(decimal),
  'cmi.interactions.n.student_response': write(string255),
  'cmi.interactions.n.result': write(
    (value) => ['correct', 'wrong', 'unanticipated', 'neutral'].includes(value) || decimal(value),
  ),
  'cmi.interactions.n.latency': write(timespan),
};

/** Arrays, keyed by normalized name, whose entries are added one at a time. */
const ARRAYS = new Set([
  'cmi.objectives',
  'cmi.interactions',
  'cmi.interactions.n.objectives',
  'cmi.interactions.n.correct_responses',
]);

export interface Normalized {
  /** The element name with array indexes replaced by `n` and `m`. */
  readonly key: string;
  /** Each array on the path as `[concrete path, index]`, outermost first. */
  readonly indexes: readonly (readonly [string, number])[];
}

export function normalize(element: string): Normalized {
  const indexes: [string, number][] = [];
  const segments = element.split('.');
  const key = segments.map((segment, position) => {
    if (!/^\d+$/.test(segment)) return segment;
    indexes.push([segments.slice(0, position).join('.'), Number(segment)]);
    return indexes.length === 1 ? 'n' : 'm';
  });
  return { key: key.join('.'), indexes };
}

export function ruleFor(key: string): ElementRule | undefined {
  return CATALOG[key];
}

export function isArray(key: string): boolean {
  return ARRAYS.has(key);
}
