import { Activity, ScormEdition, DeliveryDescriptor } from '../types';
import { HostMessage, parseWrapperMessage } from './bridge-protocol';

/** Shows an activity inside an isolated wrapper frame and starts it once the wrapper is ready. */
export class ActivityLauncher {
  private frame: HTMLIFrameElement | null = null;
  private readonly onMessage = (event: MessageEvent) => {
    if (event.origin !== this.wrapperOrigin || event.source !== this.frame?.contentWindow) return;
    const message = parseWrapperMessage(event.data);
    if (message?.kind === 'ready') {
      this.post({ v: 1, kind: 'start', url: this.activity!.resource.url });
    } else if (message?.kind === 'launch-failed') {
      this.onLaunchFailed(this.activity!);
    }
  };

  private activity: Activity | null = null;
  private delivery: DeliveryDescriptor | null = null;

  constructor(
    private readonly container: HTMLElement,
    private readonly onLaunchFailed: (activity: Activity) => void,
  ) {
    window.addEventListener('message', this.onMessage);
  }

  launch(activity: Activity, edition: ScormEdition, delivery: DeliveryDescriptor): void {
    this.activity = activity;
    this.delivery = delivery;
    const frame = document.createElement('iframe');
    frame.title = `Course content: ${activity.title}`;
    frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
    frame.src = delivery.wrapperUrl;
    frame.addEventListener('load', () =>
      this.post({ v: 1, kind: 'prepare', edition, sco: activity.resource.kind === 'sco' }),
    );
    this.container.replaceChildren(frame);
    this.frame = frame;
  }

  dispose(): void {
    window.removeEventListener('message', this.onMessage);
    this.frame?.remove();
  }

  private get wrapperOrigin(): string {
    return new URL(this.delivery!.wrapperUrl).origin;
  }

  private post(message: HostMessage): void {
    this.frame!.contentWindow!.postMessage(message, this.wrapperOrigin);
  }
}
