import { ScormEdition } from '../types';
import { SessionState } from './runtime-session';
import { normalize } from './scorm12-rules';
import { checkResponse, isArray2004, ruleFor2004 } from './scorm2004-rules';
import { NavigationValidity } from './sequencing-engine';

const ERROR_STRINGS: Record<string, string> = {
  '0': 'No Error',
  '101': 'General Exception',
  '102': 'General Initialization Failure',
  '103': 'Already Initialized',
  '104': 'Content Instance Terminated',
  '111': 'General Termination Failure',
  '112': 'Termination Before Initialization',
  '113': 'Termination After Termination',
  '122': 'Retrieve Data Before Initialization',
  '123': 'Retrieve Data After Termination',
  '132': 'Store Data Before Initialization',
  '133': 'Store Data After Termination',
  '142': 'Commit Before Initialization',
  '143': 'Commit After Termination',
  '201': 'General Argument Error',
  '301': 'General Get Failure',
  '351': 'General Set Failure',
  '391': 'General Commit Failure',
  '401': 'Undefined Data Model Element',
  '402': 'Unimplemented Data Model Element',
  '403': 'Data Model Element Value Not Initialized',
  '404': 'Data Model Element Is Read Only',
  '405': 'Data Model Element Is Write Only',
  '406': 'Data Model Element Type Mismatch',
  '407': 'Data Model Element Value Out Of Range',
  '408': 'Data Model Dependency Not Established',
};

const VALID = 'adl.nav.request_valid.';

/** The error for a call made before initialization or after termination, by call. */
const OUT_OF_SESSION = {
  terminate: ['112', '113'],
  getValue: ['122', '123'],
  setValue: ['132', '133'],
  commit: ['142', '143'],
} as const;

/** Lifecycle and data model of one SCO's SCORM 2004 session, under its edition's rules. */
export class Scorm2004Session {
  private readonly written = new Map<string, string>();
  private readonly counts = new Map<string, number>();
  private readonly overrides = new Map<string, string>();
  state: SessionState = 'not-initialized';
  lastError = '0';

  constructor(
    private readonly edition: ScormEdition,
    /** What the sequencer allowed when the SCO launched; reads report "unknown" without it. */
    private readonly navigation: NavigationValidity | null = null,
  ) {}

  initialize(argument: string): string {
    if (this.state === 'initialized') return this.fail('103');
    if (this.state === 'terminated') return this.fail('104');
    if (argument !== '') return this.fail('201');
    this.state = 'initialized';
    return this.succeed();
  }

  terminate(argument: string): string {
    if (this.state !== 'initialized') return this.outOfSession('terminate');
    if (argument !== '') return this.fail('201');
    this.state = 'terminated';
    return this.succeed();
  }

  commit(argument: string): string {
    if (this.state !== 'initialized') return this.outOfSession('commit');
    if (argument !== '') return this.fail('201');
    return this.succeed();
  }

  getValue(element: string): string {
    if (this.state !== 'initialized') return this.outOfSession('getValue', '');
    if (element.startsWith(VALID)) return this.requestValid(element.slice(VALID.length));
    const { key, indexes } = normalize(element);
    const parent = key.slice(0, key.lastIndexOf('.'));
    if (key.endsWith('._count')) {
      if (!isArray2004(parent, this.edition)) return this.keywordFailure(parent);
      if (!this.indexesExist(indexes)) return this.fail('301', '');
      return this.succeed(String(this.counts.get(element.slice(0, -'._count'.length)) ?? 0));
    }
    const rule = ruleFor2004(key, this.edition);
    if (!rule)
      return key.endsWith('._children') ? this.keywordFailure(parent) : this.fail('401', '');
    if (!this.indexesExist(indexes)) return this.fail('301', '');
    if (rule.access === 'w') return this.fail('405', '');
    const value = this.written.get(element) ?? this.overrides.get(element) ?? rule.initial;
    return value === undefined ? this.fail('403', '') : this.succeed(value);
  }

  setValue(element: string, value: string): string {
    if (this.state !== 'initialized') return this.outOfSession('setValue');
    return this.write(element, value);
  }

  /** Loads state saved by an earlier session; call before `initialize`. */
  restore(values: Record<string, string>): void {
    for (const [element, value] of Object.entries(values)) {
      if (element !== 'cmi.exit' && element !== 'adl.nav.request') this.write(element, value);
    }
    this.overrides.set('cmi.entry', values['cmi.exit'] === 'suspend' ? 'resume' : '');
    this.lastError = '0';
  }

  /** The values the SCO has written, by element name. */
  values(): Record<string, string> {
    return Object.fromEntries(this.written);
  }

  errorString(code: string): string {
    return ERROR_STRINGS[code] ?? '';
  }

  diagnostic(code: string): string {
    return this.errorString(code);
  }

  private write(element: string, value: string): string {
    if (element.startsWith(VALID)) return this.fail('404');
    const { key, indexes } = normalize(element);
    if (key === 'cmi._version' || key.endsWith('._children') || key.endsWith('._count')) {
      const parent = key.slice(0, key.lastIndexOf('.'));
      const known =
        key === 'cmi._version' ||
        ruleFor2004(key, this.edition) ||
        isArray2004(parent, this.edition);
      return this.fail(known ? '404' : '401');
    }
    const rule = ruleFor2004(key, this.edition);
    if (!rule) return this.fail('401');
    if (rule.access === 'r') return this.fail('404');
    if (indexes.some(([path, index]) => index > (this.counts.get(path) ?? 0))) {
      return this.fail('351');
    }
    const entry = indexes.length > 0 ? element.split('.').slice(0, 3).join('.') : '';
    if (rule.requires?.some((sibling) => !this.written.has(`${entry}.${sibling}`))) {
      return this.fail('408');
    }
    const invalid =
      key === 'cmi.interactions.n.learner_response'
        ? checkResponse(this.written.get(`${entry}.type`)!, value)
        : rule.check!(value, this.edition);
    if (invalid) return this.fail(invalid);
    if (key === 'cmi.objectives.n.id' && this.objectiveIdTaken(element, value)) {
      return this.fail('351');
    }
    this.written.set(element, value);
    for (const [path, index] of indexes) {
      if (index === (this.counts.get(path) ?? 0)) this.counts.set(path, index + 1);
    }
    return this.succeed();
  }

  /** `adl.nav.request_valid.continue`, `.previous`, `.choice.{target=ID}` and, in the 4th Edition, `.jump.{target=ID}`. */
  private requestValid(request: string): string {
    const known = (valid: boolean | undefined) =>
      this.succeed(valid === undefined ? 'unknown' : String(valid));
    if (request === 'continue') return known(this.navigation?.continue);
    if (request === 'previous') return known(this.navigation?.previous);
    const target = /^(choice|jump)\.\{target=([^}]+)\}$/.exec(request);
    if (!target || (target[1] === 'jump' && this.edition !== '2004-4th'))
      return this.fail('401', '');
    if (!this.navigation) return known(undefined);
    const exists = target[2] in this.navigation.choice;
    return known(target[1] === 'jump' ? exists : exists && this.navigation.choice[target[2]]);
  }

  /** Objective identifiers are unique within the SCO. */
  private objectiveIdTaken(element: string, value: string): boolean {
    return Array.from(this.written).some(
      ([other, id]) =>
        other !== element && /^cmi\.objectives\.\d+\.id$/.test(other) && id === value,
    );
  }

  /** `_children` or `_count` on an element that exists but has none is 301; otherwise 401. */
  private keywordFailure(parent: string): string {
    const exists = ruleFor2004(normalize(parent).key, this.edition);
    return this.fail(exists ? '301' : '401', '');
  }

  private indexesExist(indexes: readonly (readonly [string, number])[]): boolean {
    return indexes.every(([path, index]) => index < (this.counts.get(path) ?? 0));
  }

  private outOfSession(call: keyof typeof OUT_OF_SESSION, result = 'false'): string {
    const [before, after] = OUT_OF_SESSION[call];
    return this.fail(this.state === 'terminated' ? after : before, result);
  }

  private succeed(result = 'true'): string {
    this.lastError = '0';
    return result;
  }

  private fail(code: string, result = 'false'): string {
    this.lastError = code;
    return result;
  }
}
