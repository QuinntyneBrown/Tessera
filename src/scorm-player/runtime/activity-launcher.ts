import { Activity, ScormEdition, DeliveryDescriptor } from '../types';
import { HostMessage, parseWrapperMessage, RuntimeOperation } from './bridge-protocol';
import { createSession, ScormSession } from './sessions';
import { NavigationValidity } from './sequencing-engine';

const FLUSH_TIMEOUT_MS = 5000;

/** Shows an activity inside an isolated wrapper frame and starts it once the wrapper is ready. */
export class ActivityLauncher {
  private frame: HTMLIFrameElement | null = null;
  private readonly onMessage = (event: MessageEvent) => {
    if (event.origin !== this.wrapperOrigin || event.source !== this.frame?.contentWindow) return;
    const message = parseWrapperMessage(event.data);
    if (message?.kind === 'ready') {
      this.post({ v: 1, kind: 'start', url: this.activity!.resource.url });
    } else if (message?.kind === 'launch-failed') {
      this.events.onLaunchFailed(this.activity!);
    } else if (message?.kind === 'flushed') {
      this.flushed?.();
    } else if (message?.kind === 'operation') {
      this.apply(message.operation);
    }
  };

  private activity: Activity | null = null;
  private failureReported = false;
  private flushed: (() => void) | null = null;
  private session: ScormSession = createSession('1.2');
  private delivery: DeliveryDescriptor | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly events: {
      onLaunchFailed: (activity: Activity) => void;
      /** The SCO did something its own session accepted but the host's validation rejects. */
      onRuntimeFailure: (activity: Activity) => void;
      /** The SCO committed or terminated; `values` is the host-validated state. */
      onFlush: (activity: Activity, values: Record<string, string>, terminated: boolean) => void;
    },
  ) {
    window.addEventListener('message', this.onMessage);
  }

  launch(
    activity: Activity,
    edition: ScormEdition,
    delivery: DeliveryDescriptor,
    state: Record<string, string> | null,
    navigation: NavigationValidity | null = null,
  ): void {
    this.activity = activity;
    this.session = createSession(edition);
    this.failureReported = false;
    if (state) this.session.restore(state);
    this.delivery = delivery;
    const frame = document.createElement('iframe');
    frame.title = `Course content: ${activity.title}`;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.style.cssText = 'display:block;inline-size:100%;block-size:28.75rem;border:0';
    frame.src = delivery.wrapperUrl;
    frame.addEventListener('load', () =>
      this.post({
        v: 1,
        kind: 'prepare',
        edition,
        sco: activity.resource.kind === 'sco',
        state,
        navigation,
      }),
    );
    this.container.replaceChildren(frame);
    this.frame = frame;
  }

  /**
   * Ends the current activity: waits until the wrapper has delivered every operation, then submits the
   * host-validated state. Rejects when the wrapper does not answer, so the activity is not abandoned.
   */
  async retire(): Promise<void> {
    if (!this.frame) return;
    const delivered = new Promise<void>((resolve, reject) => {
      this.flushed = resolve;
      setTimeout(() => reject(new Error('flush timed out')), FLUSH_TIMEOUT_MS);
    });
    this.post({ v: 1, kind: 'flush' });
    await delivered;
    this.flushed = null;
    if (this.session.state === 'initialized') {
      this.session.terminate('');
      this.events.onFlush(this.activity!, this.session.values(), false);
    }
  }

  /** Removes the current activity's frame, as when the course ends. */
  clear(): void {
    this.frame?.remove();
    this.frame = null;
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage);
    this.frame?.remove();
  }

  /** Replays a SCO's operation through the host's own session, which validates it independently. */
  private apply(operation: RuntimeOperation): void {
    const session = this.session;
    let accepted: boolean;
    if (operation.kind === 'initialize') accepted = session.initialize('') === 'true';
    else if (operation.kind === 'set')
      accepted = session.setValue(operation.element, operation.value) === 'true';
    else if (operation.kind === 'commit') accepted = session.commit('') === 'true';
    else accepted = session.terminate('') === 'true';

    if (!accepted) {
      // The wrapper only posts operations its own session accepted, so this one was forged or corrupted.
      if (!this.failureReported) this.events.onRuntimeFailure(this.activity!);
      this.failureReported = true;
    } else if (operation.kind === 'commit' || operation.kind === 'terminate') {
      this.events.onFlush(this.activity!, session.values(), operation.kind === 'terminate');
    }
  }

  private get wrapperOrigin(): string {
    return new URL(this.delivery!.wrapperUrl).origin;
  }

  private post(message: HostMessage): void {
    this.frame!.contentWindow!.postMessage(message, this.wrapperOrigin);
  }
}
