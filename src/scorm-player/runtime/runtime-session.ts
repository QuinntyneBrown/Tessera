/** Lifecycle and data model of one SCO's SCORM 1.2 session. */
export class RuntimeSession {
  private readonly values = new Map<string, string>();
  lastError = '0';

  initialize(_argument: string): string {
    return 'true';
  }

  getValue(element: string): string {
    return this.values.get(element) ?? '';
  }

  setValue(element: string, value: string): string {
    this.values.set(element, value);
    return 'true';
  }
}
