import { normalize } from './scorm12-rules';
import { ruleFor2004 } from './scorm2004-rules';
import { SessionState } from './runtime-session';

/** Lifecycle and data model of one SCO's SCORM 2004 session. */
export class Scorm2004Session {
  private readonly written = new Map<string, string>();
  state: SessionState = 'not-initialized';
  lastError = '0';

  initialize(argument: string): string {
    if (argument !== '') return this.fail('201');
    this.state = 'initialized';
    return this.succeed();
  }

  terminate(argument: string): string {
    if (argument !== '') return this.fail('201');
    this.state = 'terminated';
    return this.succeed();
  }

  commit(argument: string): string {
    if (argument !== '') return this.fail('201');
    return this.succeed();
  }

  getValue(element: string): string {
    return this.succeed(this.written.get(element) ?? '');
  }

  setValue(element: string, value: string): string {
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
    return '';
  }

  diagnostic(code: string): string {
    return this.errorString(code);
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
