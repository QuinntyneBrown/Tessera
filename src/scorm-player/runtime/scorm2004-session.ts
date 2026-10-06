import { normalize } from './scorm12-rules';
import { ruleFor2004 } from './scorm2004-rules';
import { SessionState } from './runtime-session';

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

/** The error for a call made before initialization or after termination, by call. */
const OUT_OF_SESSION = {
  terminate: ['112', '113'],
  getValue: ['122', '123'],
  setValue: ['132', '133'],
  commit: ['142', '143'],
} as const;

/** Lifecycle and data model of one SCO's SCORM 2004 session. */
export class Scorm2004Session {
  private readonly written = new Map<string, string>();
  state: SessionState = 'not-initialized';
  lastError = '0';

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
    return this.succeed(this.written.get(element) ?? '');
  }

  setValue(element: string, value: string): string {
    if (this.state !== 'initialized') return this.outOfSession('setValue');
    const rule = ruleFor2004(normalize(element).key);
    if (!rule) return this.fail('401');
    if (!rule.valid!(value)) return this.fail('406');
    this.written.set(element, value);
    return this.succeed();
  }

  restore(values: Record<string, string>): void {
    for (const [element, value] of Object.entries(values)) this.written.set(element, value);
  }

  values(): Record<string, string> {
    return Object.fromEntries(this.written);
  }

  errorString(code: string): string {
    return ERROR_STRINGS[code] ?? '';
  }

  diagnostic(code: string): string {
    return this.errorString(code);
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
