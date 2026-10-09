/** SCORM 2004 run-time data model: element catalog, access rules and value validation per edition. */
import { ScormEdition } from '../types';

/** A failed check's error code: 406 for the wrong type or vocabulary, 407 for a value out of range. */
export type Check = (value: string, edition?: ScormEdition) => '406' | '407' | null;

export interface Rule2004 {
  readonly access: 'r' | 'w' | 'rw';
  /** The value before any write; without one, reading an unset value reports 403. */
  readonly initial?: string;
  readonly check?: Check;
  /** Sibling elements of the same collection entry that must be set first (error 408). */
  readonly requires?: readonly string[];
  /** Editions the element exists in; all of them when absent. */
  readonly editions?: readonly ScormEdition[];
}

const REAL = /^-?(\d+(\.\d*)?|\.\d+)$/;

const length =
  (limit: number): Check =>
  (value) =>
    value.length <= limit ? null : '407';
const vocabulary =
  (...words: string[]): Check =>
  (value) =>
    words.includes(value) ? null : '406';
const real =
  (min = -Infinity, max = Infinity): Check =>
  (value) =>
    !REAL.test(value) ? '406' : Number(value) < min || Number(value) > max ? '407' : null;
const identifier: Check = (value) =>
  value === '' || /\s/.test(value) ? '406' : value.length <= 4000 ? null : '407';
const localized =
  (limit: number): Check =>
  (value) => {
    const match = /^\{lang=([^}]*)\}/.exec(value);
    if (match && !isLanguage(match[1])) return '406';
    return length(limit)(match ? value.slice(match[0].length) : value);
  };
const language: Check = (value) => (value === '' || isLanguage(value) ? null : '406');
const duration: Check = (value) => {
  const match =
    /^P(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d{1,2})?S)?)?$/.exec(value);
  return match && value !== 'P' && !value.endsWith('T') ? null : '406';
};
const timestamp: Check = (value) => {
  const match =
    /^(\d{4})(?:-(\d{2})(?:-(\d{2})(?:T(\d{2})(?::(\d{2})(?::(\d{2})(?:\.\d{1,2})?(?:Z|[+-]\d{2}(?::\d{2})?)?)?)?)?)?)?$/.exec(
      value,
    );
  if (!match) return '406';
  const [year, month = 1, day = 1, hour = 0, minute = 0, second = 0] = match
    .slice(1)
    .map((part) => (part === undefined ? undefined : Number(part)));
  return year! >= 1970 &&
    year! <= 2038 &&
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= 31 &&
    hour < 24 &&
    minute < 60 &&
    second < 60
    ? null
    : '406';
};

function isLanguage(value: string): boolean {
  return /^([a-zA-Z]{2,3}|i|x)(-[a-zA-Z0-9]{1,8})*$/.test(value);
}

const COMPLETION = vocabulary('completed', 'incomplete', 'not attempted', 'unknown');
const SUCCESS = vocabulary('passed', 'failed', 'unknown');
const INTERACTION_TYPES = [
  'true-false',
  'choice',
  'fill-in',
  'long-fill-in',
  'matching',
  'performance',
  'sequencing',
  'likert',
  'numeric',
  'other',
];

/** Navigation requests a SCO may make, by the editions that define them. */
function navigationRequest(value: string, edition?: ScormEdition): '406' | null {
  const simple = ['continue', 'previous', 'exit', 'exitAll', 'abandon', 'abandonAll', 'suspendAll'];
  if (simple.includes(value) || value === '_none_') return null;
  const target = /^\{target=([^}\s]+)\}(choice|jump)$/.exec(value);
  if (target && (target[2] === 'choice' || edition === '2004-4th')) return null;
  return '406';
}

const read = (initial?: string, editions?: readonly ScormEdition[]): Rule2004 => ({
  access: 'r',
  initial,
  editions,
});
const write = (check: Check): Rule2004 => ({ access: 'w', check });
const readWrite = (check: Check, initial?: string, requires?: readonly string[]): Rule2004 => ({
  access: 'rw',
  check,
  initial,
  requires,
});

const scoreChildren = (prefix: string, requires?: readonly string[]) => ({
  [`${prefix}._children`]: read('scaled,raw,min,max'),
  [`${prefix}.scaled`]: readWrite(real(-1, 1), undefined, requires),
  [`${prefix}.raw`]: readWrite(real(), undefined, requires),
  [`${prefix}.min`]: readWrite(real(), undefined, requires),
  [`${prefix}.max`]: readWrite(real(), undefined, requires),
});

const OBJECTIVE = ['id'];
const INTERACTION = ['id'];
const TYPED_INTERACTION = ['id', 'type'];

/** Element rules keyed by normalized name: the first array index is `n`, the second is `m`. */
const CATALOG: Readonly<Record<string, Rule2004>> = {
  'cmi._version': read('1.0'),
  'cmi.comments_from_learner._children': read('comment,location,timestamp'),
  'cmi.comments_from_learner.n.comment': readWrite(localized(4000)),
  'cmi.comments_from_learner.n.location': readWrite(length(250)),
  'cmi.comments_from_learner.n.timestamp': readWrite(timestamp),
  'cmi.comments_from_lms._children': read('comment,location,timestamp'),
  'cmi.comments_from_lms.n.comment': read(),
  'cmi.comments_from_lms.n.location': read(),
  'cmi.comments_from_lms.n.timestamp': read(),
  'cmi.completion_status': readWrite(COMPLETION, 'unknown'),
  'cmi.completion_threshold': read(),
  'cmi.credit': read('credit'),
  'cmi.entry': read('ab-initio'),
  'cmi.exit': write(vocabulary('time-out', 'suspend', 'logout', 'normal', '')),
  'cmi.interactions._children': read(
    'id,type,objectives,timestamp,correct_responses,weighting,learner_response,result,latency,description',
  ),
  'cmi.interactions.n.id': readWrite(identifier),
  'cmi.interactions.n.type': readWrite(vocabulary(...INTERACTION_TYPES), undefined, INTERACTION),
  'cmi.interactions.n.objectives.m.id': readWrite(identifier, undefined, INTERACTION),
  'cmi.interactions.n.timestamp': readWrite(timestamp, undefined, INTERACTION),
  'cmi.interactions.n.correct_responses.m.pattern': readWrite(
    length(4000),
    undefined,
    TYPED_INTERACTION,
  ),
  'cmi.interactions.n.weighting': readWrite(real(), undefined, INTERACTION),
  'cmi.interactions.n.learner_response': readWrite(length(4000), undefined, TYPED_INTERACTION),
  'cmi.interactions.n.result': readWrite(
    (value) =>
      ['correct', 'incorrect', 'unanticipated', 'neutral'].includes(value) || REAL.test(value)
        ? null
        : '406',
    undefined,
    INTERACTION,
  ),
  'cmi.interactions.n.latency': readWrite(duration, undefined, INTERACTION),
  'cmi.interactions.n.description': readWrite(localized(250), undefined, INTERACTION),
  'cmi.launch_data': read(),
  'cmi.learner_id': read(''),
  'cmi.learner_name': read(''),
  'cmi.learner_preference._children': read('audio_level,language,delivery_speed,audio_captioning'),
  'cmi.learner_preference.audio_level': readWrite(real(0), '1'),
  'cmi.learner_preference.language': readWrite(language, ''),
  'cmi.learner_preference.delivery_speed': readWrite(real(0), '1'),
  'cmi.learner_preference.audio_captioning': readWrite(vocabulary('-1', '0', '1'), '0'),
  'cmi.location': readWrite(length(1000)),
  'cmi.max_time_allowed': read(),
  'cmi.mode': read('normal'),
  'cmi.objectives._children': read(
    'id,score,success_status,completion_status,progress_measure,description',
  ),
  'cmi.objectives.n.id': readWrite(identifier),
  ...scoreChildren('cmi.objectives.n.score', OBJECTIVE),
  'cmi.objectives.n.success_status': readWrite(SUCCESS, 'unknown', OBJECTIVE),
  'cmi.objectives.n.completion_status': readWrite(COMPLETION, 'unknown', OBJECTIVE),
  'cmi.objectives.n.progress_measure': readWrite(real(0, 1), undefined, OBJECTIVE),
  'cmi.objectives.n.description': readWrite(localized(250), undefined, OBJECTIVE),
  'cmi.progress_measure': readWrite(real(0, 1)),
  'cmi.scaled_passing_score': read(),
  ...scoreChildren('cmi.score'),
  'cmi.session_time': write(duration),
  'cmi.success_status': readWrite(SUCCESS, 'unknown'),
  'cmi.suspend_data': readWrite((value, edition) =>
    length(edition === '2004-4th' ? 64000 : 4000)(value),
  ),
  'cmi.time_limit_action': read('continue,no message'),
  'cmi.total_time': read('PT0H0M0S'),
  'adl.nav.request': readWrite(navigationRequest, '_none_'),
  'adl.data._children': read('id,store', ['2004-4th']),
};

/** Arrays, keyed by normalized name, whose entries are added one at a time. */
const ARRAYS: Readonly<Record<string, readonly ScormEdition[] | undefined>> = {
  'cmi.comments_from_learner': undefined,
  'cmi.comments_from_lms': undefined,
  'cmi.interactions': undefined,
  'cmi.interactions.n.objectives': undefined,
  'cmi.interactions.n.correct_responses': undefined,
  'cmi.objectives': undefined,
  // Shared data stores exist only in the 4th Edition; this player declares none.
  'adl.data': ['2004-4th'],
};

export function ruleFor2004(key: string, edition: ScormEdition): Rule2004 | undefined {
  const rule = CATALOG[key];
  return rule && (!rule.editions || rule.editions.includes(edition)) ? rule : undefined;
}

export function isArray2004(key: string, edition: ScormEdition): boolean {
  if (!(key in ARRAYS)) return false;
  const editions = ARRAYS[key];
  return !editions || editions.includes(edition);
}

/** Checks a learner response or correct-response pattern against its interaction type. */
export function checkResponse(type: string, value: string): '406' | '407' | null {
  const items = value.split('[,]');
  const shortIdentifier = (item: string) => /^[^\s[\]]{1,250}$/.test(item);
  switch (type) {
    case 'true-false':
      return value === 'true' || value === 'false' ? null : '406';
    case 'choice':
      return (value === '' || items.every(shortIdentifier)) && new Set(items).size === items.length
        ? null
        : '406';
    case 'likert':
      return shortIdentifier(value) ? null : '406';
    case 'numeric':
      return REAL.test(value) ? null : '406';
    default:
      return length(4000)(value);
  }
}
