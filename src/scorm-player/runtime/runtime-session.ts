export type SessionState = 'not-initialized' | 'initialized' | 'terminated';

const ERROR_STRINGS: Record<string, string> = {
  '0': 'No error',
  '101': 'General exception',
  '201': 'Invalid argument error',
  '202': 'Element cannot have children',
  '203': 'Element not an array. Cannot have count',
  '301': 'Not initialized',
  '401': 'Not implemented error',
  '402': 'Invalid set value, element is a keyword',
  '403': 'Element is read only',
  '404': 'Element is write only',
  '405': 'Incorrect Data Type',
};

const KNOWN_ELEMENTS = new Set(['cmi.core.lesson_location', 'cmi.suspend_data']);

/** Lifecycle and data model of one SCO's SCORM 1.2 session. */
export class RuntimeSession {
  private readonly values = new Map<string, string>();
  state: SessionState = 'not-initialized';
  lastError = '0';

  initialize(argument: string): string {
    if (argument !== '') return this.fail('201');
    if (this.state !== 'not-initialized') return this.fail('101');
    this.state = 'initialized';
    return this.succeed();
  }

  terminate(argument: string): string {
    if (this.state !== 'initialized') return this.fail('301');
    if (argument !== '') return this.fail('201');
    this.state = 'terminated';
    return this.succeed();
  }

  commit(argument: string): string {
    if (this.state !== 'initialized') return this.fail('301');
    if (argument !== '') return this.fail('201');
    return this.succeed();
  }

  getValue(element: string): string {
    if (this.state !== 'initialized') return this.fail('301', '');
    if (!KNOWN_ELEMENTS.has(element)) return this.fail('201', '');
    this.lastError = '0';
    return this.values.get(element) ?? '';
  }

  setValue(element: string, value: string): string {
    if (this.state !== 'initialized') return this.fail('301');
    if (!KNOWN_ELEMENTS.has(element)) return this.fail('201');
    this.values.set(element, value);
    return this.succeed();
  }

  errorString(code: string): string {
    return ERROR_STRINGS[code] ?? '';
  }

  diagnostic(code: string): string {
    return this.errorString(code);
  }

  private succeed(): string {
    this.lastError = '0';
    return 'true';
  }

  private fail(code: string, result = 'false'): string {
    this.lastError = code;
    return result;
  }
}
