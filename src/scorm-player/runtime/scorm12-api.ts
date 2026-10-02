import { RuntimeSession } from './runtime-session';

/** The SCORM 1.2 `API` object a SCO discovers in a parent window. */
export class Scorm12Api {
  constructor(private readonly session: RuntimeSession) {}

  LMSInitialize(argument: string): string {
    return this.session.initialize(argument);
  }

  LMSFinish(argument: string): string {
    return this.session.terminate(argument);
  }

  LMSGetValue(element: string): string {
    return this.session.getValue(element);
  }

  LMSSetValue(element: string, value: string): string {
    return this.session.setValue(element, value);
  }

  LMSCommit(argument: string): string {
    return this.session.commit(argument);
  }

  LMSGetLastError(): string {
    return this.session.lastError;
  }

  LMSGetErrorString(code: string): string {
    return this.session.errorString(code);
  }

  LMSGetDiagnostic(code: string): string {
    return this.session.diagnostic(code);
  }
}
