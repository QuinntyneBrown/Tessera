import { RuntimeSession } from './runtime-session';

/** The SCORM 1.2 `API` object a SCO discovers in a parent window. */
export class Scorm12Api {
  constructor(private readonly session: RuntimeSession) {}

  LMSInitialize(argument: string): string {
    return this.session.initialize(argument);
  }

  LMSGetValue(element: string): string {
    return this.session.getValue(element);
  }

  LMSSetValue(element: string, value: string): string {
    return this.session.setValue(element, value);
  }

  LMSGetLastError(): string {
    return this.session.lastError;
  }
}
