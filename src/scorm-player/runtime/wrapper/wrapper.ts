import { HostMessage, WrapperMessage } from '../bridge-protocol';

// Runs on the isolated course origin: exposes the SCORM API, then starts the activity in a nested frame.
let hostOrigin = '';

function send(message: WrapperMessage): void {
  window.parent.postMessage(message, hostOrigin);
}

window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
  if (event.source !== window.parent) return;
  hostOrigin = event.origin;
  const message = event.data;
  if (message.kind === 'prepare') {
    if (message.sco) {
      (window as unknown as { API: object }).API = Object.freeze({});
    }
    send({ v: 1, kind: 'ready' });
  } else if (message.kind === 'start') {
    const frame = document.createElement('iframe');
    frame.title = 'Course activity';
    frame.src = message.url;
    document.body.append(frame);
  }
});
