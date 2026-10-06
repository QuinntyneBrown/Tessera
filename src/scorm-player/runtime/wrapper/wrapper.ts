import { HostMessage, RuntimeOperation, WrapperMessage } from '../bridge-protocol';
import { RuntimeSession } from '../runtime-session';
import { Scorm12Api } from '../scorm12-api';
import { Scorm2004Api } from '../scorm2004-api';
import { Scorm2004Session } from '../scorm2004-session';
import { createSession, ScormSession } from '../sessions';

// Runs on the isolated course origin: exposes the SCORM API, then starts the activity in a nested frame.
let hostOrigin = '';
let session: ScormSession | null = null;

function send(message: WrapperMessage): void {
  window.parent.postMessage(message, hostOrigin);
}

window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
  if (event.source !== window.parent) return;
  hostOrigin = event.origin;
  const message = event.data;
  if (message.kind === 'prepare') {
    if (message.sco) {
      session = createSession(message.edition, message.navigation);
      if (message.state) session.restore({ ...message.state });
      const post = (operation: RuntimeOperation) => send({ v: 1, kind: 'operation', operation });
      if (session instanceof RuntimeSession) {
        (window as unknown as { API: Scorm12Api }).API = new Scorm12Api(session, post);
      } else {
        (window as unknown as { API_1484_11: Scorm2004Api }).API_1484_11 = new Scorm2004Api(
          session as Scorm2004Session,
          post,
        );
      }
    }
    send({ v: 1, kind: 'ready' });
  } else if (message.kind === 'flush') {
    // The host is about to retire this activity: end its session so late calls fail with 301.
    session?.terminate('');
    send({ v: 1, kind: 'flushed' });
  } else if (message.kind === 'start') {
    // An iframe load event cannot prove HTTP success, so check the launch page first.
    fetch(message.url).then(
      (response) => (response.ok ? startFrame(message.url) : send({ v: 1, kind: 'launch-failed' })),
      () => send({ v: 1, kind: 'launch-failed' }),
    );
  }
});

function startFrame(url: string): void {
  const frame = document.createElement('iframe');
  frame.title = 'Course activity';
  frame.src = url;
  document.body.append(frame);
}
