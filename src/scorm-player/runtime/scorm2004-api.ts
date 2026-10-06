import { RuntimeOperation } from './bridge-protocol';
import { Scorm2004Session } from './scorm2004-session';

/** The SCORM 2004 `API_1484_11` object a SCO discovers in a parent window. */
export class Scorm2004Api {
  constructor(
    private readonly session: Scorm2004Session,
    private readonly post: (operation: RuntimeOperation) => void = () => {},
  ) {}

  Initialize(argument: string): string {
    return this.report(this.session.initialize(argument), { kind: 'initialize' });
  }

  Terminate(argument: string): string {
    return this.report(this.session.terminate(argument), { kind: 'terminate' });
  }

  GetValue(element: string): string {
    return this.session.getValue(element);
  }

  SetValue(element: string, value: string): string {
    return this.report(this.session.setValue(element, value), { kind: 'set', element, value });
  }

  Commit(argument: string): string {
    return this.report(this.session.commit(argument), { kind: 'commit' });
  }

  GetLastError(): string {
    return this.session.lastError;
  }

  GetErrorString(code: string): string {
    return this.session.errorString(code);
  }

  GetDiagnostic(code: string): string {
    return this.session.diagnostic(code);
  }

  /** Posts an operation to the host once it has succeeded locally, then passes the result through. */
  private report(result: string, operation: RuntimeOperation): string {
    if (result === 'true') this.post(operation);
    return result;
  }
}
