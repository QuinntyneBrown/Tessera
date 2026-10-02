import { isArray, normalize, ruleFor } from './scorm12-rules';

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

/** Lifecycle and data model of one SCO's SCORM 1.2 session. */
export class RuntimeSession {
  private readonly values = new Map<string, string>();
  private readonly counts = new Map<string, number>();
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
    const { key, indexes } = normalize(element);
    if (key.endsWith('._count')) {
      if (!isArray(key.slice(0, -'._count'.length))) return this.fail('203', '');
      if (!this.indexesExist(indexes)) return this.fail('201', '');
      return this.succeed(String(this.counts.get(element.slice(0, -'._count'.length)) ?? 0));
    }
    const rule = ruleFor(key);
    if (!rule) return this.fail(key.endsWith('._children') ? '202' : '201', '');
    if (!this.indexesExist(indexes)) return this.fail('201', '');
    if (rule.access === 'w') return this.fail('404', '');
    return this.succeed(this.values.get(element) ?? rule.initial ?? '');
  }

  setValue(element: string, value: string): string {
    if (this.state !== 'initialized') return this.fail('301');
    const { key, indexes } = normalize(element);
    if (key.endsWith('._children') || key.endsWith('._count')) return this.fail('402');
    const rule = ruleFor(key);
    if (!rule) return this.fail('201');
    if (rule.access === 'r') return this.fail('403');
    if (indexes.some(([path, index]) => index > (this.counts.get(path) ?? 0)))
      return this.fail('201');
    if (!rule.valid!(value)) return this.fail('405');
    this.values.set(element, value);
    for (const [path, index] of indexes) {
      if (index === (this.counts.get(path) ?? 0)) this.counts.set(path, index + 1);
    }
    return this.succeed();
  }

  errorString(code: string): string {
    return ERROR_STRINGS[code] ?? '';
  }

  diagnostic(code: string): string {
    return this.errorString(code);
  }

  private succeed(result = 'true'): string {
    this.lastError = '0';
    return result;
  }

  private indexesExist(indexes: readonly (readonly [string, number])[]): boolean {
    return indexes.every(([path, index]) => index < (this.counts.get(path) ?? 0));
  }

  private fail(code: string, result = 'false'): string {
    this.lastError = code;
    return result;
  }
}
