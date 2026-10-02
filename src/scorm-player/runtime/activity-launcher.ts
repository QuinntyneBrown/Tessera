import { Activity, ScormEdition, DeliveryDescriptor } from '../types';
import { HostMessage, parseWrapperMessage, RuntimeOperation } from './bridge-protocol';
import { RuntimeSession } from './runtime-session';

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
    } else if (message?.kind === 'operation') {
      this.apply(message.operation);
    }
  };

  private activity: Activity | null = null;
  private session = new RuntimeSession();
  private delivery: DeliveryDescriptor | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly events: {
      onLaunchFailed: (activity: Activity) => void;
      /** The SCO committed or terminated; `values` is the host-validated state. */
      onFlush: (activity: Activity, values: Record<string, string>) => void;
    },
  ) {
    window.addEventListener('message', this.onMessage);
  }

  launch(
    activity: Activity,
    edition: ScormEdition,
    delivery: DeliveryDescriptor,
    state: Record<string, string> | null,
  ): void {
    this.activity = activity;
    this.session = new RuntimeSession();
    if (state) this.session.restore(state);
    this.delivery = delivery;
    const frame = document.createElement('iframe');
    frame.title = `Course content: ${activity.title}`;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.src = delivery.wrapperUrl;
    frame.addEventListener('load', () =>
      this.post({ v: 1, kind: 'prepare', edition, sco: activity.resource.kind === 'sco', state }),
    );
    this.container.replaceChildren(frame);
    this.frame = frame;
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage);
    this.frame?.remove();
  }

  /** Replays a SCO's operation through the host's own session, which validates it independently. */
  private apply(operation: RuntimeOperation): void {
    const session = this.session;
    if (operation.kind === 'initialize') session.initialize('');
    else if (operation.kind === 'set') session.setValue(operation.element, operation.value);
    else if (operation.kind === 'commit' && session.commit('') === 'true') {
      this.events.onFlush(this.activity!, session.values());
    } else if (operation.kind === 'terminate' && session.terminate('') === 'true') {
      this.events.onFlush(this.activity!, session.values());
    }
  }

  private get wrapperOrigin(): string {
    return new URL(this.delivery!.wrapperUrl).origin;
  }

  private post(message: HostMessage): void {
    this.frame!.contentWindow!.postMessage(message, this.wrapperOrigin);
  }
}
