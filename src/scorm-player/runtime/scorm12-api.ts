import { RuntimeOperation } from './bridge-protocol';
import { RuntimeSession } from './runtime-session';

/** The SCORM 1.2 `API` object a SCO discovers in a parent window. */
export class Scorm12Api {
  constructor(
    private readonly session: RuntimeSession,
    private readonly post: (operation: RuntimeOperation) => void = () => {},
  ) {}

  LMSInitialize(argument: string): string {
    return this.report(this.session.initialize(argument), { kind: 'initialize' });
  }

  LMSFinish(argument: string): string {
    return this.report(this.session.terminate(argument), { kind: 'terminate' });
  }

  LMSGetValue(element: string): string {
    return this.session.getValue(element);
  }

  LMSSetValue(element: string, value: string): string {
    return this.report(this.session.setValue(element, value), { kind: 'set', element, value });
  }

  LMSCommit(argument: string): string {
    return this.report(this.session.commit(argument), { kind: 'commit' });
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

  /** Posts an operation to the host once it has succeeded locally, then passes the result through. */
  private report(result: string, operation: RuntimeOperation): string {
    if (result === 'true') this.post(operation);
    return result;
  }
}
